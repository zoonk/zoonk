defmodule ZoonkWeb.Onboarding.OnboardingRecommendationsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_permissions}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex flex-col items-center justify-center">
      <.full_page_spinner
        :if={@recommendations == []}
        title={dgettext("onboarding", "We're finding specializations that will help you learn")}
        feature={@input}
        subtitle={
          dgettext(
            "onboarding",
            "This might take a moment as we prepare personalized recommendations for you."
          )
        }
      />

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
