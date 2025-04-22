defmodule ZoonkWeb.Onboarding.OnboardingRecommendationsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.AI.Agents.OnboardingRecommender

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_permissions}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex flex-col items-center justify-center">
      <.full_page_spinner
        :if={@courses.loading}
        title={dgettext("onboarding", "We're finding specializations that will help you learn")}
        feature={@input}
        subtitle={
          dgettext(
            "onboarding",
            "This might take a moment as we prepare personalized recommendations for you."
          )
        }
      />

      <div :if={@courses.ok?} class="w-full">
        <div :for={recommendation <- @courses.result} class="course-item">
          <p>{recommendation.title}</p>
        </div>
      </div>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(params, session, socket) do
    input = params["input"]
    language = session["language"]

    socket =
      socket
      |> assign(:page_title, dgettext("onboarding", "Recommendations for %{input}", input: input))
      |> assign(:input, input)
      |> assign_async(:courses, fn -> OnboardingRecommender.recommend(input, language) end)

    {:ok, socket}
  end
end
