defmodule ZoonkWeb.LearnSubjectResultsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.AI.Tasks.RecommendCourses

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
      :let={courses}
      flash={@flash}
      scope={@scope}
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
    >
      <header class="mx-auto py-8 text-center" aria-labelledby="page-header">
        <.text id="page-header" tag="h1" size={:xxl}>
          {dgettext("learning", "Recommendations for you")}
        </.text>

        <.text tag="h2" size={:lg} variant={:secondary}>
          {dgettext("learning", "Pick one to get started")}
        </.text>
      </header>

      <ul
        :if={courses}
        class="mx-auto max-w-xl"
        phx-window-keydown={JS.navigate(~p"/learn")}
        phx-key="escape"
        aria-label={dgettext("learning", "List of recommended courses")}
      >
        <li :for={{recommendation, index} <- Enum.with_index(courses)} class="group">
          <a
            href="#"
            class={[
              "border-zk-border flex justify-between gap-2 border-b py-4",
              "hover:bg-zk-secondary/75",
              "group-first:pt-0 group-last:border-b-0",
              "focus-visible:bg-zk-secondary/75 focus-visible:outline-0"
            ]}
            aria-labelledby={"recommendation-#{index}"}
          >
            <div class="flex flex-col gap-1">
              <.text id={"recommendation-#{index}"} tag="h3" weight={:semibold}>
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
      |> assign_async(:courses, fn -> RecommendCourses.recommend(input, language) end)

    {:ok, socket}
  end

  defp get_color(index) do
    @colors
    |> Enum.shuffle()
    |> Enum.at(index)
  end
end
