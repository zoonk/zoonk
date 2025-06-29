defmodule ZoonkWeb.StripeWebhookController do
  use ZoonkWeb, :controller

  plug :verify_signature

  def create(conn, %{"type" => _type}) do
    conn
    |> send_resp(200, "Webhook received")
    |> halt()
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
