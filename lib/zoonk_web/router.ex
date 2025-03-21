defmodule ZoonkWeb.Router do
  use ZoonkWeb, :router

  import ZoonkWeb.AdminUser
  import ZoonkWeb.Language
  import ZoonkWeb.UserAuth

  @allowed_images "https://avatars.githubusercontent.com https://*.googleusercontent.com"

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ZoonkWeb.Layouts, :root}
    plug :protect_from_forgery

    plug :put_secure_browser_headers, %{
      "content-security-policy" =>
        "base-uri 'self'; frame-ancestors 'self'; default-src 'self'; img-src 'self' #{@allowed_images} data: blob:;"
    }

    plug :fetch_current_scope_for_user
    plug :set_session_language
  end

  # This should only be used in rare cases where you want to skip protections like CSRF
  # One example is when using an oAuth POST request for the `Sign In with Apple` feature.
  pipeline :unprotected_browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ZoonkWeb.Layouts, :root}
    plug :put_secure_browser_headers, %{"content-security-policy" => "default-src 'self';img-src 'self' data: blob:;"}
    plug :fetch_current_scope_for_user
    plug :set_session_language
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", ZoonkWeb.Live do
    pipe_through [:browser, :require_authenticated_user]

    live_session :require_authenticated_user,
      on_mount: [
        {ZoonkWeb.UserAuth, :ensure_authenticated},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/", Home

      live "/goals", BrowseGoals

      live "/catalog", BrowseCatalog

      live "/library", BrowseLibrary

      live "/user/email", UserEmail
      live "/user/email/confirm/:token", UserEmail
    end
  end

  scope "/", ZoonkWeb.Live do
    pipe_through [:browser]

    live_session :public_routes,
      layout: {ZoonkWeb.Layouts, :auth},
      on_mount: [
        {ZoonkWeb.UserAuth, :mount_current_scope},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/signup", UserSignUp
      live "/signup/email", UserSignUpWithEmail
      live "/login", UserLogin
      live "/login/email", UserLoginWithEmail
    end
  end

  scope "/", ZoonkWeb.Controllers do
    pipe_through [:browser]

    post "/login", UserSession, :create
    delete "/logout", UserSession, :delete
    get "/login/t/:token", UserSession, :login
    get "/confirm/:token", UserSession, :confirm

    get "/auth/:provider", OAuth, :request
    get "/auth/:provider/callback", OAuth, :callback

    # Legal routes
    get "/terms", Legal, :terms
    get "/privacy", Legal, :privacy
  end

  # We need this because Apple's oAuth handling sends a POST request
  # instead of a GET so we can't have a CSRF token in their request.
  # We should not use this scope for anything else.
  scope "/", ZoonkWeb.Controllers do
    pipe_through [:unprotected_browser]
    post "/auth/:provider/callback", OAuth, :callback
  end

  scope "/admin", ZoonkWeb.Live do
    pipe_through [:browser, :require_authenticated_user, :require_admin_user]

    live_session :admin_dashboard,
      layout: {ZoonkWeb.Layouts, :admin},
      on_mount: [
        {ZoonkWeb.UserAuth, :ensure_authenticated},
        {ZoonkWeb.AdminUser, :ensure_user_admin},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/", AdminHome
      live "/users", AdminUsers
      live "/users/search", AdminUsers, :search
      live "/users/:id", AdminUser
    end
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

    # We have a playground for testing UI components in the dev environment.
    scope "/ui", ZoonkDev.Live do
      pipe_through :browser

      live_session :ui_playground,
        layout: {ZoonkDev.Layouts, :ui} do
        live "/", UIHome
        live "/anchor", UIAnchor
        live "/avatar", UIAvatar
        live "/button", UIButton
        live "/card", UICard
        live "/divider", UIDivider
      end
    end
  end
end
