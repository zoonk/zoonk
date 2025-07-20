defmodule ZoonkWeb.UserSubscriptionController do
  @moduledoc """
  Controller for managing user subscription actions.
  """
  use ZoonkWeb, :controller
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Billing

  @doc """
  Creates a checkout session for a user subscription.
  """
  def checkout(conn, %{"price" => price}) when is_binary(price) and price != "" do
    scope = conn.assigns.scope

    with {:ok, billing_account} <- check_billing_account(scope),
         {:ok, checkout_session} <- create_checkout_session(scope, price, billing_account, conn) do
      redirect(conn, external: checkout_session["url"])
    else
      {:error, :missing_billing_account} ->
        conn
        |> put_flash(:error, dgettext("settings", "Please set up billing first to subscribe to a plan."))
        |> redirect(to: ~p"/subscription")

      {:error, :stripe_error} ->
        conn
        |> put_flash(:error, dgettext("settings", "Payment service is temporarily unavailable. Please try again later."))
        |> redirect(to: ~p"/subscription")
    end
  end

  def checkout(conn, _params) do
    conn
    |> put_flash(:error, dgettext("settings", "Invalid subscription request. Please select a plan."))
    |> redirect(to: ~p"/subscription")
  end

  defp check_billing_account(%Zoonk.Scope{} = scope) do
    case Billing.get_billing_account(scope) do
      nil -> {:error, :missing_billing_account}
      billing_account -> {:ok, billing_account}
    end
  end

  defp create_checkout_session(scope, price, _billing_account, conn) do
    url = return_url(conn)

    attrs = %{
      "success_url" => url,
      "cancel_url" => url
    }

    case Billing.subscription_checkout_session(scope, price, attrs) do
      {:ok, session} -> {:ok, session}
      {:error, _reason} -> {:error, :stripe_error}
    end
  end

  defp return_url(%Plug.Conn{host: host, scheme: scheme, port: port}) do
    if Application.get_env(:zoonk, :dev_routes) do
      "#{scheme}://#{host}:#{port}/subscription"
    else
      "#{scheme}://#{host}/subscription"
    end
  end
end
