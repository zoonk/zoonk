defmodule ZoonkWeb.StripeWebhookController do
  use ZoonkWeb, :controller

  require Logger

  alias Zoonk.Billing
  alias Zoonk.Repo
  alias Zoonk.Scope

  plug :verify_signature

  @doc """
  Handles incoming Stripe webhook events.

  Processes subscription lifecycle events and checkout session completions.
  """
  def create(conn, %{"type" => event_type, "data" => %{"object" => event_object}} = params) do
    Logger.info("Received Stripe webhook: #{event_type}")

    case handle_event(event_type, event_object, params) do
      :ok ->
        send_resp(conn, 200, "Webhook processed successfully")

      {:error, reason} ->
        Logger.error("Failed to process webhook #{event_type}: #{inspect(reason)}")
        send_resp(conn, 500, "Webhook processing failed")
    end
  end

  def create(conn, params) do
    Logger.warning("Received unhandled Stripe webhook: #{inspect(params)}")
    send_resp(conn, 200, "Webhook received but not processed")
  end

  # Handle customer subscription created
  defp handle_event("customer.subscription.created", subscription, _params) do
    with {:ok, scope} <- get_scope_from_metadata(subscription["metadata"]),
         {:ok, _subscription} <- create_or_update_subscription(scope, subscription) do
      :ok
    end
  end

  # Handle customer subscription updated
  defp handle_event("customer.subscription.updated", subscription, _params) do
    with {:ok, scope} <- get_scope_from_metadata(subscription["metadata"]),
         {:ok, _subscription} <- create_or_update_subscription(scope, subscription) do
      :ok
    end
  end

  # Handle customer subscription deleted
  defp handle_event("customer.subscription.deleted", subscription, _params) do
    with {:ok, scope} <- get_scope_from_metadata(subscription["metadata"]),
         subscription_record <- Billing.get_user_subscription(scope),
         {:ok, _updated} <- update_subscription_status(scope, subscription_record, :canceled) do
      :ok
    end
  end

  # Handle checkout session completed
  defp handle_event("checkout.session.completed", session, _params) do
    handle_checkout_session_completed(session)
  end

  # Handle async payment succeeded
  defp handle_event("checkout.session.async_payment_succeeded", session, _params) do
    handle_checkout_session_completed(session)
  end

  # Handle async payment failed
  defp handle_event("checkout.session.async_payment_failed", session, _params) do
    with {:ok, scope} <- get_scope_from_metadata(session["metadata"]) do
      Logger.error("Async payment failed for user #{scope.user.id} in org #{scope.org.id}")
      # Could implement notification logic here
      :ok
    end
  end

  # Handle unrecognized events
  defp handle_event(event_type, _event_object, _params) do
    Logger.info("Unhandled Stripe webhook event: #{event_type}")
    :ok
  end

  # Handle checkout session completion
  defp handle_checkout_session_completed(session) do
    mode = session["mode"]

    case mode do
      "subscription" ->
        handle_subscription_checkout_completed(session)

      "payment" ->
        handle_payment_checkout_completed(session)

      _ ->
        Logger.warning("Unknown checkout session mode: #{mode}")
        :ok
    end
  end

  # Handle subscription checkout completion
  defp handle_subscription_checkout_completed(session) do
    subscription_id = session["subscription"]

    if subscription_id do
      # The actual subscription creation will be handled by customer.subscription.created event
      Logger.info("Subscription checkout completed, subscription ID: #{subscription_id}")
      :ok
    else
      {:error, "No subscription ID in session"}
    end
  end

  # Handle payment checkout completion (for lifetime plans)
  defp handle_payment_checkout_completed(session) do
    with {:ok, scope} <- get_scope_from_metadata(session["metadata"]),
         {:ok, attrs} <- build_subscription_attrs_from_session(session),
         {:ok, _subscription} <- Billing.create_user_subscription(scope, attrs) do
      :ok
    end
  end

  # Get scope from Stripe metadata
  defp get_scope_from_metadata(metadata) do
    with user_id when is_binary(user_id) <- metadata["user_id"],
         org_id when is_binary(org_id) <- metadata["org_id"],
         {user_id_int, ""} <- Integer.parse(user_id),
         {org_id_int, ""} <- Integer.parse(org_id),
         user <- Repo.get(Zoonk.Accounts.User, user_id_int),
         org <- Repo.get(Zoonk.Orgs.Org, org_id_int) do
      scope = %Scope{user: user, org: org}
      {:ok, scope}
    else
      _ -> {:error, "Invalid metadata"}
    end
  end

  # Create or update subscription from Stripe subscription object
  defp create_or_update_subscription(scope, stripe_subscription) do
    attrs = %{
      stripe_subscription_id: stripe_subscription["id"],
      plan: map_stripe_plan_to_internal(stripe_subscription),
      payment_term: map_stripe_interval_to_internal(stripe_subscription),
      status: map_stripe_status_to_internal(stripe_subscription["status"]),
      expires_at: parse_stripe_timestamp(stripe_subscription["current_period_end"]),
      cancel_at_period_end: stripe_subscription["cancel_at_period_end"] || false
    }

    case Billing.get_user_subscription(scope) do
      nil ->
        Billing.create_user_subscription(scope, attrs)

      existing_subscription ->
        Billing.update_user_subscription(scope, existing_subscription, attrs)
    end
  end

  # Build subscription attributes from checkout session (for lifetime payments)
  defp build_subscription_attrs_from_session(session) do
    metadata = session["metadata"]

    attrs = %{
      plan: String.to_existing_atom(metadata["plan"]),
      payment_term: String.to_existing_atom(metadata["payment_term"]),
      status: :active,
      expires_at: ~U[9999-12-31 23:59:59Z], # Far future for lifetime
      cancel_at_period_end: false
    }

    {:ok, attrs}
  end

  # Update subscription status
  defp update_subscription_status(scope, subscription, status) when not is_nil(subscription) do
    Billing.update_user_subscription(scope, subscription, %{status: status})
  end

  defp update_subscription_status(_scope, nil, _status), do: {:ok, nil}

  # Map Stripe plan to internal enum
  defp map_stripe_plan_to_internal(stripe_subscription) do
    # Extract plan from price lookup_key or default to :plus
    case get_in(stripe_subscription, ["items", "data"]) do
      [%{"price" => %{"lookup_key" => lookup_key}} | _] when is_binary(lookup_key) ->
        if String.contains?(lookup_key, "plus"), do: :plus, else: :free

      _ ->
        :plus
    end
  end

  # Map Stripe interval to internal payment term
  defp map_stripe_interval_to_internal(stripe_subscription) do
    case get_in(stripe_subscription, ["items", "data"]) do
      [%{"price" => %{"recurring" => %{"interval" => "month"}}} | _] -> :monthly
      [%{"price" => %{"recurring" => %{"interval" => "year"}}} | _] -> :yearly
      _ -> :monthly
    end
  end

  # Map Stripe status to internal enum
  defp map_stripe_status_to_internal(stripe_status) do
    case stripe_status do
      "incomplete" -> :incomplete
      "incomplete_expired" -> :incomplete_expired
      "trialing" -> :trialing
      "active" -> :active
      "past_due" -> :past_due
      "canceled" -> :canceled
      "unpaid" -> :unpaid
      "paused" -> :paused
      _ -> :incomplete
    end
  end

  # Parse Stripe timestamp to DateTime
  defp parse_stripe_timestamp(nil), do: nil
  defp parse_stripe_timestamp(timestamp) when is_integer(timestamp) do
    DateTime.from_unix!(timestamp, :second)
  end

  defp verify_signature(conn, []) do
    secret = Application.fetch_env!(:zoonk, :stripe)[:webhook_secret]
    "whsec_" <> _rest = secret

    with {:ok, signature} <- get_signature(conn),
         :ok <- Zoonk.Stripe.WebhookSignature.verify(conn.assigns.raw_body, signature, secret) do
      conn
    else
      {:error, error} ->
        conn
        |> put_resp_content_type("text/plain; charset=utf-8")
        |> send_resp(400, "invalid signature: " <> escape_error(error))
        |> halt()
    end
  end

  defp get_signature(conn) do
    case get_req_header(conn, "stripe-signature") do
      [header] -> {:ok, header}
      _missing -> {:error, "no signature"}
    end
  end

  defp escape_error(error) do
    error
    |> Plug.HTML.html_escape_to_iodata()
    |> IO.iodata_to_binary()
  end
end
