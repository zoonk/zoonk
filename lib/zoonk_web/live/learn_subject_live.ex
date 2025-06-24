defmodule ZoonkWeb.LearnSubjectLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <div class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 text-center">
        <.text tag="h1" size={:xxl} aria-hidden="true">
          {dgettext("learning", "What do you want to learn?")}
        </.text>

        <.form for={@form} id="recommendations" phx-submit="submit" class="w-full">
          <.input
            field={@form[:query]}
            label={dgettext("learning", "What do you want to learn?")}
            hide_label
            type="text"
            class="w-full px-4 py-3.5 shadow-md md:px-6 md:text-lg"
            required
            submit_icon="tabler-arrow-up"
            placeholder={dgettext("learning", "e.g. computer science, astronomy, biology, ...")}
          />
        </.form>
      </div>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, session, socket) do
    app_language = Map.get(session, "language", "en")

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
