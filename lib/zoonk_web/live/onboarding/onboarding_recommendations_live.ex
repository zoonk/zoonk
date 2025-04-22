defmodule ZoonkWeb.Onboarding.OnboardingRecommendationsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.AI.Agents.OnboardingRecommender

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_permissions}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <.async_page
      :let={recommendations}
      data={@courses}
      loading_title={dgettext("onboarding", "We're finding specializations that will help you learn")}
      loading_subtitle={
        dgettext(
          "onboarding",
          "This might take a moment as we prepare personalized recommendations for you."
        )
      }
      loading_feature={@input}
      failure_message={dgettext("onboarding", "Sorry, we couldn't find any recommendations for you.")}
      failure_link={~p"/start"}
      failure_link_text={gettext("Back")}
      class="mx-auto flex max-w-4xl flex-col gap-4 p-0"
    >
      <ul :if={recommendations}>
        <li :for={recommendation <- recommendations}>
          <div>
            <.text tag="h3" size={:lg} variant={:primary} class="group-hover:text-zk-primary-text">
              {recommendation.title}
            </.text>

            <.text variant={:secondary} class="max-w-prose">
              {recommendation.description}
            </.text>
          </div>
        </li>
      </ul>
    </.async_page>
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
