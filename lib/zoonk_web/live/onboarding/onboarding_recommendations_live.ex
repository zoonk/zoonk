defmodule ZoonkWeb.Onboarding.OnboardingRecommendationsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_permissions}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex flex-col items-center justify-center">
      <div
        :if={@recommendations == []}
        class="flex w-full max-w-md flex-col items-center justify-center p-8 text-center"
      >
        <div class="mb-8">
          <div class="border-zk-primary mx-auto h-16 w-16 animate-spin rounded-full border-t-4"></div>
        </div>

        <.text tag="h2" size={:xl} class="mb-4">
          {dgettext("onboarding", "We're finding specializations that will help you learn")}
          <em class="text-zk-primary">{@input}</em>
        </.text>

        <.text variant={:secondary}>
          {dgettext(
            "onboarding",
            "This might take a moment as we prepare personalized recommendations for you."
          )}
        </.text>
      </div>

      <div :if={@recommendations != []} class="w-full"></div>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(params, _session, socket) do
    input = params["input"]

    socket =
      socket
      |> assign(:page_title, dgettext("onboarding", "Recommendations for %{input}", input: input))
      |> assign(:input, input)
      |> assign(:recommendations, [])

    {:ok, socket}
  end
end
