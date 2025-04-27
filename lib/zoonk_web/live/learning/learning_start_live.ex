defmodule ZoonkWeb.Learning.LearningStartLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Config.LanguageConfig

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex w-full items-center justify-center p-4">
      <div class="flex w-full max-w-lg flex-col items-center gap-4 text-center">
        <.text tag="h1" size={:xxl}>
          {dgettext("learning", "What do you want to learn?")}
        </.text>

        <.form
          for={@form}
          action={if @scope.user, do: nil, else: ~p"/learn"}
          phx-submit={@scope.user && "submit"}
          class="w-full"
        >
          <.input
            field={@form[:query]}
            label={dgettext("learning", "What do you want to learn?")}
            hide_label
            type="text"
            class="w-full"
            required
            placeholder={dgettext("learning", "E.g. Computer Science, Astronomy, Biology, etc.")}
          />

          <div class={[
            "mt-2 flex items-center gap-4",
            @scope.user && "justify-around",
            !@scope.user && "justify-between"
          ]}>
            <.input
              :if={!@scope.user}
              field={@form[:language]}
              hide_label
              label={dgettext("users", "Language")}
              type={if @scope.user, do: "hidden", else: "select"}
              options={LanguageConfig.list_languages(:options)}
              required
            />

            <.button
              type="submit"
              size={:md}
              variant={:primary}
              phx-disable-with={dgettext("learning", "Loading...")}
            >
              {dgettext("learning", "Get Started")}
            </.button>
          </div>
        </.form>
      </div>
    </main>
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
