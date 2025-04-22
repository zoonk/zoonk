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
      class="mx-auto flex max-w-5xl flex-col gap-4 p-4 xl:px-0"
    >
      <nav>
        <.a navigate={~p"/start"} kind={:button} size={:sm} variant={:outline}>
          {gettext("Back")}
        </.a>
      </nav>

      <header class="mx-auto py-8 text-center">
        <.text tag="h1" size={:xxl}>
          {dgettext("onboarding", "Recommendations for you")}
        </.text>

        <.text tag="h3" size={:lg} variant={:secondary}>
          {dgettext("onboarding", "Pick one to get started")}
        </.text>
      </header>

      <ul :if={recommendations}>
        <li :for={recommendation <- recommendations}>
          <a href="#">
            <.text tag="h3" size={:lg} variant={:primary} class="group-hover:text-zk-primary-text">
              {recommendation.title}
            </.text>

            <.text variant={:secondary} class="max-w-prose">
              {recommendation.description}
            </.text>
          </a>
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
