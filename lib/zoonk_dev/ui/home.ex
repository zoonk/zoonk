defmodule ZoonkDev.Live.UIHome do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <.card>
        <.card_header icon="tabler-palette-filled">
          <.card_title>UI Playground</.card_title>
          <.card_description>Test and experiment with UI components</.card_description>
        </.card_header>

        <.card_content>
          <.text>
            You can use this space to test different components and their configurations.
          </.text>
        </.card_content>
      </.card>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, "UI Playground")

    {:ok, socket}
  end
end
