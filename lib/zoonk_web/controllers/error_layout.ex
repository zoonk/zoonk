defmodule ZoonkWeb.ErrorLayout do
  @moduledoc false
  use ZoonkWeb, :html

  attr :conn, :any, default: nil
  slot :inner_block, required: true

  def render(assigns) do
    put_locale(assigns.conn)

    ~H"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csrf-token" content={get_csrf_token()} />

        <title>Zoonk</title>

        <link phx-track-static rel="stylesheet" href={~p"/assets/app.css"} />
        <link phx-track-static rel="stylesheet" href={~p"/error/error.css"} />

        <link rel="apple-touch-icon" sizes="180x180" href={~p"/images/favicon/180.png"} />
        <link rel="icon" type="image/png" sizes="32x32" href={~p"/images/favicon/32.png"} />
        <link rel="icon" type="image/png" sizes="16x16" href={~p"/images/favicon/16.png"} />

        <script defer phx-track-static type="text/javascript" src={~p"/assets/app.js"}>
        </script>
        <script defer phx-track-static type="text/javascript" src={~p"/error/error.js"}>
        </script>
      </head>

      <body class="bg-zk-background">
        {render_slot(@inner_block)}
      </body>
    </html>
    """
  end

  defp put_locale(%Plug.Conn{} = conn) do
    conn
    |> ZoonkWeb.Language.get_browser_language()
    |> Gettext.put_locale()
  end

  defp put_locale(_conn), do: nil
end
