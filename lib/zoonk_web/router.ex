defmodule ZoonkWeb.Router do
  use ZoonkWeb, :router

  import ZoonkWeb.CSP
  import ZoonkWeb.Language
  import ZoonkWeb.UserAuth
  import ZoonkWeb.UserAuthorization

  alias ZoonkWeb.UserAuth
  alias ZoonkWeb.UserAuthorization

  @allowed_images "https://avatars.githubusercontent.com https://github.com https://*.googleusercontent.com"
  @allowed_scripts "https://ph.zoonk.com"

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ZoonkWeb.RootLayout, :render}
    plug :put_layout, false
    plug :protect_from_forgery
    plug :set_csp_nonce

    plug :put_secure_browser_headers, %{
      "content-security-policy" =>
        "base-uri 'self'; frame-ancestors 'self'; default-src 'self'; img-src 'self' #{@allowed_images} data: blob:; script-src-elem 'self' #{@allowed_scripts}; connect-src 'self' #{@allowed_scripts}; worker-src 'self' blob: data:;"
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
    plug :fetch_api_scope
  end

  pipeline :webhooks do
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

      live "/catalog", CatalogLive

      live "/learn", LearnSubjectLive
      live "/learn/:input", LearnSubjectResultsLive

      live "/my-courses", MyCoursesLive
      live "/missions", MissionsLive

      live "/purchases", PurchasesLive
      live "/subscription", SubscriptionLive
      live "/billing", BillingLive

      live "/language", LanguageLive
      live "/name", NameLive
      live "/email", EmailLive

      live "/feedback", FeedbackLive
      live "/support", SupportLive
      live "/follow", FollowLive

      live "/confirm/email", AuthConfirmCodeLive, :email
    end
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser]

    live_session :public_routes,
      on_mount: [
        {UserAuth, :mount_scope},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/signup", AuthSignUpLive
      live "/signup/email", AuthSignUpWithEmailLive
      live "/login", AuthLoginLive
      live "/login/email", AuthLoginWithEmailLive

      live "/confirm/login", AuthConfirmCodeLive, :login
      live "/confirm/signup", AuthConfirmCodeLive, :signup
    end
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser]

    post "/confirm", UserSessionController, :create
    delete "/logout", UserSessionController, :delete

    get "/auth/:provider", OAuthController, :request
    get "/auth/:provider/callback", OAuthController, :callback

    # Legal routes
    get "/terms", LegalController, :terms
    get "/privacy", LegalController, :privacy
  end

  # We need this because Apple's oAuth handling sends a POST request
  # instead of a GET so we can't have a CSRF token in their request.
  # We should not use this scope for anything else.
  scope "/", ZoonkWeb do
    pipe_through [:unprotected_browser]
    post "/auth/:provider/callback", OAuthController, :callback
  end

  scope "/webhooks", ZoonkWeb do
    pipe_through [:webhooks]

    post "/stripe", StripeWebhookController, :create
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

    # API v1 routes, temporarily disabled for v0.1
    scope "/api/v1", ZoonkWeb do
      pipe_through :api

      scope "/auth", API.V1.Accounts do
        post "/signup", OTPController, :signup
        post "/request_code", OTPController, :request_code
        post "/verify_code", OTPController, :verify_code
        delete "/logout", AuthController, :logout
      end
    end

    # We have a playground for testing UI components in the dev environment.
    scope "/ui", ZoonkDev.UIPreview do
      pipe_through :browser

      live_session :ui_playground do
        live "/", UIPreviewHomeLive
        live "/accordion", AccordionPreviewLive
        live "/anchor", AnchorPreviewLive
        live "/avatar", AvatarPreviewLive
        live "/button", ButtonPreviewLive
        live "/card", CardPreviewLive
        live "/command", CommandPreviewLive
        live "/divider", DividerPreviewLive
        live "/dropdown", DropdownPreviewLive
        live "/flash", FlashPreviewLive
        live "/form", FormPreviewLive
        live "/input", InputPreviewLive
        live "/loader", LoaderPreviewLive
        live "/text", TextPreviewLive
      end
    end
  end
end
