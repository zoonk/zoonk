defmodule ZoonkWeb.CSP do
  @moduledoc """
  Content Security Policy (CSP) plugs.
  """

  @doc """
  Sets a CSP nonce for the response. This nonce can be used in the CSP header
  and in the HTML template to allow inline scripts/styles.

  ## Example

      <script nonce={assigns[:csp_nonce]}>
        // Your inline script here
      </script>

  """
  def set_csp_nonce(conn, _opts) do
    nonce =
      16
      |> :crypto.strong_rand_bytes()
      |> Base.encode64(padding: false)

    Plug.Conn.assign(conn, :csp_nonce, nonce)
  end
end
