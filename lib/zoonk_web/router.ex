defmodule ZoonkWeb.Router do
  use ZoonkWeb, :router

  import ZoonkWeb.Plugs.Language
  import ZoonkWeb.Plugs.UserAuth

  alias ZoonkWeb.Hooks

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ZoonkWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers, %{"content-security-policy" => "default-src 'self';img-src 'self' data: blob:;"}
    plug :fetch_current_user
    plug :set_session_language
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  # Other scopes may use custom stacks.
  # scope "/api", ZoonkWeb do
  #   pipe_through :api
  # end

  ## Authentication routes

  scope "/", ZoonkWeb.Live do
    pipe_through [:browser, :require_authenticated_user]

    live_session :require_authenticated_user,
      on_mount: [
        {Hooks.UserAuth, :ensure_authenticated},
        {Hooks.Language, :set_app_language}
      ] do
      live "/", Home, :index
      live "/users/settings", UserSettings, :edit
      live "/users/settings/confirm-email/:token", UserSettings, :confirm_email
    end
  end

  scope "/", ZoonkWeb.Live do
    pipe_through [:browser]

    live_session :current_user,
      on_mount: [
        {Hooks.UserAuth, :mount_current_user},
        {Hooks.Language, :set_app_language}
      ] do
      live "/users/signup", UserSignUp, :new
      live "/users/signin", UserSignIn, :new
      live "/users/signin/:token", UserConfirmation, :new
    end
  end

  scope "/", ZoonkWeb.Controllers do
    pipe_through [:browser]

    post "/users/signin", UserAuth, :create
    delete "/users/signout", UserAuth, :delete
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:zoonk, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: ZoonkWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
