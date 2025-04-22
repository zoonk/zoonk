defmodule ZoonkWeb.Onboarding.OnboardingRecommendationsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.AI.Agents.OnboardingRecommender

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_progress}

  @colors [
    "text-red-500",
    "text-orange-500",
    "text-amber-500",
    "text-green-500",
    "text-blue-500",
    "text-indigo-500",
    "text-purple-500",
    "text-violet-500",
    "text-fuchsia-500",
    "text-pink-500",
    "text-gray-500"
  ]

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

        <.text tag="h2" size={:lg} variant={:secondary}>
          {dgettext("onboarding", "Pick one to get started")}
        </.text>
      </header>

      <ul :if={recommendations} class="mx-auto max-w-xl">
        <li :for={{recommendation, index} <- Enum.with_index(recommendations)} class="group">
          <a
            href="#"
            class={[
              "border-zk-border flex gap-2 border-b py-4",
              "hover:bg-zk-secondary/75",
              "group-first:pt-0 group-last:border-b-0",
              "focus-visible:bg-zk-secondary/75 focus-visible:outline-0"
            ]}
          >
            <div class="flex flex-col gap-1">
              <.text tag="h3" weight={:semibold}>
                {recommendation.title}
              </.text>

              <.text size={:sm} variant={:secondary} class="line-clamp-2">
                {recommendation.description}
              </.text>
            </div>

            <div
              aria-hidden
              class="size-17 bg-zk-secondary/75 flex shrink-0 flex-col items-center justify-center rounded-lg"
            >
              <.dynamic_icon
                name={recommendation.icon || "tabler-book"}
                variant={:filled}
                class={["size-8", get_color(index)]}
              />
            </div>
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

  defp get_color(index) do
    @colors
    |> Enum.shuffle()
    |> Enum.at(index)
  end
end
