defmodule ZoonkWeb.RootLayout do
  @moduledoc false
  use ZoonkWeb, :html

  def render(assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang={Plug.Conn.get_session(@conn, :language)}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csrf-token" content={get_csrf_token()} />

        <.live_title default="Zoonk">{assigns[:page_title]}</.live_title>

        <link phx-track-static rel="stylesheet" href={~p"/assets/app.css"} />

        <link rel="apple-touch-icon" sizes="180x180" href={~p"/images/favicon/180.png"} />
        <link rel="icon" type="image/png" sizes="32x32" href={~p"/images/favicon/32.png"} />
        <link rel="icon" type="image/png" sizes="16x16" href={~p"/images/favicon/16.png"} />

        <script
          defer
          phx-track-static
          data-ph-enable={to_string(Application.get_env(:posthog, :enabled_capture, false))}
          data-ph-key={Application.get_env(:posthog, :api_key)}
          data-user-id={@scope.user && @scope.user.id}
          data-nonce={assigns[:csp_nonce]}
          type="text/javascript"
          src={~p"/assets/app.js"}
        >
        </script>
      </head>
      <body class="bg-zk-background">
        {@inner_content}
      </body>
    </html>
    """
  end
end
