defmodule ZoonkWeb.StripeWebhookController do
  use ZoonkWeb, :controller

  import Zoonk.Helpers

  alias Zoonk.Billing
  alias Zoonk.Scope

  plug :verify_signature

  def create(conn, %{"type" => "customer.subscription.created"} = event) do
    data = event["data"]["object"]
    stripe_customer_id = data["customer"]
    user = Billing.get_user_from_stripe_customer_id(stripe_customer_id)

    scope = %Scope{org: conn.assigns.scope.org, user: user}

    attrs = %{
      stripe_subscription_id: data["id"],
      plan: plan_from_stripe_data(data),
      interval: interval_from_stripe_data(data),
      status: to_existing_atom(data["status"], :incomplete),
      cancel_at_period_end: data["cancel_at_period_end"],
      expires_at: current_period_end(data)
    }

    Billing.create_user_subscription(scope, attrs)

    success_response(conn)
  end

  def create(conn, %{"type" => "customer.subscription.updated"} = event) do
    data = event["data"]["object"]
    stripe_subscription_id = data["id"]

    user_subscription = Billing.get_user_subscription_by_stripe_id(stripe_subscription_id)

    scope = %Scope{org: conn.assigns.scope.org, user: user_subscription.user, subscription: user_subscription}

    attrs = %{
      plan: plan_from_stripe_data(data),
      interval: interval_from_stripe_data(data),
      status: to_existing_atom(data["status"], :incomplete),
      cancel_at_period_end: data["cancel_at_period_end"] || false,
      expires_at: current_period_end(data)
    }

    Billing.update_user_subscription(scope, attrs)

    success_response(conn)
  end

  def create(conn, %{"type" => "customer.subscription.deleted"} = event) do
    data = event["data"]["object"]
    stripe_subscription_id = data["id"]

    user_subscription = Billing.get_user_subscription_by_stripe_id(stripe_subscription_id)

    scope = %Scope{org: conn.assigns.scope.org, user: user_subscription.user, subscription: user_subscription}

    Billing.update_user_subscription(scope, %{
      status: :canceled,
      cancel_at_period_end: true
    })

    success_response(conn)
  end

  def create(conn, %{"type" => _type}) do
    success_response(conn)
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

  defp plan_from_stripe_data(object) do
    object
    |> extract_lookup_key()
    |> plan_from_lookup_key()
  end

  defp plan_from_lookup_key([plan, _interval]), do: to_existing_atom(plan, :free)
  defp plan_from_lookup_key(_keys), do: :free

  defp interval_from_stripe_data(object) do
    object
    |> extract_lookup_key()
    |> interval_from_lookup_key()
  end

  defp interval_from_lookup_key([_plan, interval]), do: to_existing_atom(interval, :monthly)
  defp interval_from_lookup_key(_keys), do: :monthly

  defp extract_lookup_key(%{"items" => items}) do
    items["data"]
    |> List.first()
    |> get_in(["price", "lookup_key"])
    |> String.split("_")
  end

  defp current_period_end(%{"items" => items}) do
    items["data"]
    |> List.first()
    |> Map.get("current_period_end")
    |> DateTime.from_unix!()
  end

  defp success_response(conn) do
    conn
    |> send_resp(:ok, "Webhook received")
    |> halt()
  end
end
