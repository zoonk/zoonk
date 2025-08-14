defmodule ZoonkWeb.Router do
  use ZoonkWeb, :router

  import ZoonkWeb.CSP
  import ZoonkWeb.Language
  import ZoonkWeb.UserAuth

  @allowed_images "https://avatars.githubusercontent.com https://github.com https://*.googleusercontent.com"

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
        "base-uri 'self'; frame-ancestors 'self'; default-src 'self'; img-src 'self' #{@allowed_images} data: blob:; script-src-elem 'self'; connect-src 'self'; worker-src 'self' blob: data:;"
    }

    plug :fetch_scope
    plug :set_session_language
    plug :maybe_store_return_to
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
    plug :maybe_store_return_to
  end

  pipeline :webhooks do
    plug :accepts, ["json"]
    plug :fetch_session
    plug :fetch_scope
  end

  scope "/", ZoonkWeb do
    pipe_through [:browser]

    live_session :default,
      on_mount: [
        {ZoonkWeb.UserAuth, :mount_scope},
        {ZoonkWeb.Language, :set_app_language}
      ] do
      live "/", AppHomeLive

      live "/catalog", CatalogLive

      live "/learn", LearnSubjectLive
      live "/learn/:input", LearnSubjectResultsLive

      live "/my-courses", UserCoursesLive

      live "/subscription", UserSubscriptionLive
      live "/tax-id", UserTaxIdLive

      live "/language", UserLanguageLive
      live "/name", UserNameLive
      live "/email", UserEmailLive
      live "/interests", UserInterestsLive

      live "/feedback", AppFeedbackLive
      live "/support", AppSupportLive
      live "/follow", AppFollowLive

      live "/confirm/email", AuthConfirmCodeLive, :email

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

  scope "/", ZoonkWeb do
    pipe_through [:browser, :require_authenticated_user]

    post "/subscription/checkout", UserSubscriptionController, :checkout
    post "/subscription/manage", UserSubscriptionController, :manage
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
        live "/pill", PillPreviewLive
        live "/text", TextPreviewLive
        live "/toggle", TogglePreviewLive
      end
    end
  end
end
