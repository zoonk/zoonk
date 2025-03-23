defmodule ZoonkWeb.Router do
  use ZoonkWeb, :router

  import ZoonkWeb.Accounts.UserAuth
  import ZoonkWeb.Admin.AdminUser
  import ZoonkWeb.Language

  alias ZoonkWeb.Accounts.UserAuth

  @allowed_images "https://avatars.githubusercontent.com https://*.googleusercontent.com"

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ZoonkWeb.RootLayout, :render}
    plug :put_layout, false
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
    plug :put_root_layout, html: {ZoonkWeb.RootLayout, :render}
    plug :put_secure_browser_headers, %{"content-security-policy" => "default-src 'self';img-src 'self' data: blob:;"}
    plug :fetch_current_scope_for_user
    plug :set_session_language
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser, :require_authenticated_user]

    live_session :require_authenticated_user,
      on_mount: [
        {UserAuth, :ensure_authenticated},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/", AppHomeLive

      live "/goals", Goals.GoalsHomeLive

      live "/catalog", Catalog.CatalogHomeLive

      live "/library", Library.LibraryHomeLive

      live "/user/email", User.UserEmailLive
      live "/user/email/confirm/:token", User.UserEmailLive
    end
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser]

    live_session :public_routes,
      on_mount: [
        {UserAuth, :mount_current_scope},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/signup", User.UserSignUpLive
      live "/signup/email", User.UserSignUpWithEmailLive
      live "/login", User.UserLoginLive
      live "/login/email", User.UserLoginWithEmailLive
    end
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser]

    post "/login", Accounts.UserSessionController, :create
    delete "/logout", Accounts.UserSessionController, :delete
    get "/login/t/:token", Accounts.UserSessionController, :login
    get "/confirm/:token", Accounts.UserSessionController, :confirm

    get "/auth/:provider", Accounts.OAuthController, :request
    get "/auth/:provider/callback", Accounts.OAuthController, :callback

    # Legal routes
    get "/terms", Accounts.LegalController, :terms
    get "/privacy", Accounts.LegalController, :privacy
  end

  # We need this because Apple's oAuth handling sends a POST request
  # instead of a GET so we can't have a CSRF token in their request.
  # We should not use this scope for anything else.
  scope "/", ZoonkWeb do
    pipe_through [:unprotected_browser]
    post "/auth/:provider/callback", Accounts.OAuthController, :callback
  end

  scope "/admin", ZoonkWeb do
    pipe_through [:browser, :require_authenticated_user, :require_admin_user]

    live_session :admin_dashboard,
      on_mount: [
        {UserAuth, :ensure_authenticated},
        {ZoonkWeb.Admin.AdminUser, :ensure_user_admin},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/", Admin.AdminHomeLive
      live "/users", Admin.AdminUserListLive
      live "/users/search", Admin.AdminUserListLive, :search
      live "/users/:id", Admin.AdminUserViewLive
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
    scope "/ui", ZoonkDev.UIPreview do
      pipe_through :browser

      live_session :ui_playground do
        live "/", UIPreviewHomeLive
        live "/anchor", AnchorPreviewLive
        live "/avatar", AvatarPreviewLive
        live "/button", ButtonPreviewLive
        live "/card", CardPreviewLive
        live "/divider", DividerPreviewLive
        live "/flash", FlashPreviewLive
        live "/form", FormPreviewLive
        live "/input", InputPreviewLive
        live "/text", TextPreviewLive
      end
    end
  end
end
