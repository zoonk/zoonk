defmodule ZoonkWeb.ErrorLayout do
  @moduledoc false
  use ZoonkWeb, :html

  def render(assigns) do
    assigns.conn
    |> ZoonkWeb.Language.get_browser_language()
    |> Gettext.put_locale()

    ~H"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csrf-token" content={get_csrf_token()} />

        <title>Zoonk</title>

        <link phx-track-static rel="stylesheet" href={~p"/assets/app.css"} />

        <link rel="apple-touch-icon" sizes="180x180" href={~p"/images/favicon/180.png"} />
        <link rel="icon" type="image/png" sizes="32x32" href={~p"/images/favicon/32.png"} />
        <link rel="icon" type="image/png" sizes="16x16" href={~p"/images/favicon/16.png"} />

        <script defer phx-track-static type="text/javascript" src={~p"/assets/app.js"}>
        </script>
      </head>

      <body class="bg-zk-background">
        {render_slot(@inner_block)}
      </body>
    </html>
    """
  end
end
