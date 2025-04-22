defmodule ZoonkWeb.Onboarding.OnboardingStartLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_start}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex w-full items-center justify-center p-4">
      <div class="absolute top-4 right-4">
        <.a kind={:button} size={:sm} navigate={~p"/login"}>
          {gettext("Login")}
        </.a>

        <.a kind={:button} variant={:outline} size={:sm} navigate={~p"/signup"}>
          {gettext("Sign Up")}
        </.a>
      </div>

      <div class="flex w-full max-w-lg flex-col items-center gap-4 text-center">
        <.text tag="h1" size={:xxl}>
          {dgettext("onboarding", "What do you want to learn?")}
        </.text>

        <form class="w-full">
          <.input
            name="subject"
            type="text"
            value=""
            class="w-full"
            placeholder={dgettext("onboarding", "E.g. Computer Science, Astronomy, Biology, etc.")}
          />
        </form>
      </div>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, session, socket) do
    app_language = Map.get(session, "language", "en")

    socket =
      socket
      |> assign(:page_title, dgettext("onboarding", "Get Started"))
      |> assign(:app_language, app_language)

    {:ok, socket}
  end
end
