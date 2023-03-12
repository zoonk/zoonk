defmodule ZoonkWeb.Plugs.CustomSecureBrowserHeaders do
  @moduledoc """
  Update Phoenix's headers to include additional secure browser headers such like the
  [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
  """

  def init(options), do: options

  def call(conn, _opts) do
    nonce = generate_nonce()
    csp_headers = get_csp_headers(conn.request_path, nonce)

    conn
    |> Plug.Conn.assign(:csp_nonce_value, nonce)
    |> Phoenix.Controller.put_secure_browser_headers(csp_headers)
  end

  defp get_csp_headers("/dev/mailbox" <> _rest, _nonce),
    do: %{"content-security-policy" => "style-src 'unsafe-inline'"}

  defp get_csp_headers("/dev/dashboard" <> _rest, nonce),
    do: %{"content-security-policy" => "style-src 'self' 'nonce-#{nonce}'"}

  defp get_csp_headers(_path, _nonce),
    do: %{"content-security-policy" => "default-src 'self'; img-src 'self' data:"}

  defp generate_nonce(size \\ 10),
    do: size |> :crypto.strong_rand_bytes() |> Base.url_encode64(padding: false)
end
