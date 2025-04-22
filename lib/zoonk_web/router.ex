defmodule ZoonkWeb.Router do
  use ZoonkWeb, :router

  import ZoonkWeb.Language
  import ZoonkWeb.UserAuth
  import ZoonkWeb.UserAuthorization

  alias ZoonkWeb.UserAuth
  alias ZoonkWeb.UserAuthorization

  @allowed_images "https://avatars.githubusercontent.com https://github.com https://*.googleusercontent.com"

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

    plug :fetch_scope
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
    plug :fetch_scope
    plug :set_session_language
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser, :require_authenticated_user, :require_org_member, :require_org_admin]

    live_session :require_authenticated_user,
      on_mount: [
        {UserAuth, :ensure_authenticated},
        {UserAuthorization, :ensure_org_member},
        {UserAuthorization, :ensure_org_admin},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/", AppHomeLive

      live "/goals", Goals.GoalsHomeLive

      live "/catalog", Catalog.CatalogHomeLive

      live "/library", Library.LibraryHomeLive

      live "/user/email", User.UserEmailLive
      live "/user/email/confirm/:token", User.UserEmailLive
      live "/user/billing", User.UserBillingLive
      live "/user/interests", User.UserInterestsLive

      live "/editor", Editor.EditorHomeLive
      live "/editor/new", Editor.EditorNewLive

      live "/org", Org.OrgHomeLive
      live "/org/teams", Org.OrgTeamsLive
      live "/org/members", Org.OrgMembersLive
      live "/org/settings", Org.OrgSettingsLive
    end
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser]

    live_session :public_routes,
      on_mount: [
        {UserAuth, :mount_scope},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/start", Onboarding.OnboardingStartLive
      live "/start/:input", Onboarding.OnboardingRecommendationsLive

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

    post "/start", Onboarding.OnboardingController, :create

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
        live "/command", CommandPreviewLive
        live "/divider", DividerPreviewLive
        live "/flash", FlashPreviewLive
        live "/form", FormPreviewLive
        live "/input", InputPreviewLive
        live "/spinner", SpinnerPreviewLive
        live "/text", TextPreviewLive
      end
    end
  end
end
