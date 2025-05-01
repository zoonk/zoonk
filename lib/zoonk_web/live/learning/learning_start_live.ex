defmodule ZoonkWeb.Learning.LearningStartLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Analytics

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex w-full items-center justify-center p-4">
      <nav class="absolute top-4 left-4" aria-label={gettext("Actions")}>
        <.back_link navigate={~p"/"} label={gettext("Home page")} />
      </nav>

      <div class="flex w-full max-w-lg flex-col items-center gap-4 text-center">
        <.text tag="h1" size={:xxl} aria-hidden="true">
          {dgettext("learning", "What do you want to learn?")}
        </.text>

        <.form for={@form} phx-submit="submit" class="w-full">
          <.input
            field={@form[:query]}
            label={dgettext("learning", "What do you want to learn?")}
            hide_label
            type="text"
            class="w-full"
            required
            submit_icon="tabler-arrow-up"
            placeholder={dgettext("learning", "E.g. Computer Science, Astronomy, Biology, etc.")}
          />
        </.form>
      </div>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, session, socket) do
    app_language = Map.get(session, "language", "en")

    Analytics.capture("goal_learning_start", socket.assigns.scope, %{language: app_language})

    socket =
      socket
      |> assign(:page_title, dgettext("learning", "Get Started"))
      |> assign(:form, to_form(%{"language" => app_language, "query" => ""}))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("submit", %{"query" => query}, socket) do
    {:noreply, push_navigate(socket, to: ~p"/learn/#{query}")}
  end
end
