defmodule ZoonkWeb.Onboarding.OnboardingRecommendationsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_permissions}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex">
      recommendations
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(params, _session, socket) do
    input = params["input"]

    socket = assign(socket, :page_title, dgettext("onboarding", "Recommendations for %{input}", input: input))

    {:ok, socket}
  end
end
