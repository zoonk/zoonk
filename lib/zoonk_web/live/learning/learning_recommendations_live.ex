defmodule ZoonkWeb.Learning.LearningRecommendationsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.AI.Agents.LearningRecommender

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
      loading_title={dgettext("learning", "We're finding courses to help you learn")}
      loading_subtitle={
        dgettext(
          "learning",
          "This might take a moment as we prepare personalized recommendations for you."
        )
      }
      loading_feature={@input}
      failure_message={dgettext("learning", "Sorry, we had an internal error. Please, try again.")}
      failure_link={~p"/learn"}
      failure_link_text={gettext("Back")}
      class="mx-auto flex max-w-5xl flex-col gap-4 p-4 xl:px-0"
    >
      <nav>
        <.back_link navigate={~p"/learn"} />
      </nav>

      <header class="mx-auto py-8 text-center">
        <.text tag="h1" size={:xxl}>
          {dgettext("learning", "Recommendations for you")}
        </.text>

        <.text tag="h2" size={:lg} variant={:secondary}>
          {dgettext("learning", "Pick one to get started")}
        </.text>
      </header>

      <ul
        :if={recommendations}
        class="mx-auto max-w-xl"
        phx-window-keydown={JS.navigate(~p"/learn")}
        phx-key="escape"
      >
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
                name={recommendation.icon}
                default="tabler-book"
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
      |> assign(:page_title, dgettext("learning", "Recommendations for %{input}", input: input))
      |> assign(:input, input)
      |> assign_async(:courses, fn -> LearningRecommender.recommend(input, language) end)

    {:ok, socket}
  end

  defp get_color(index) do
    @colors
    |> Enum.shuffle()
    |> Enum.at(index)
  end
end
