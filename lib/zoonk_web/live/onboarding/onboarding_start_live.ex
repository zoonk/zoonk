defmodule ZoonkWeb.Onboarding.OnboardingStartLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_permissions}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex w-full items-center justify-center p-4">
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
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("onboarding", "Get Started"))
    {:ok, socket}
  end
end
