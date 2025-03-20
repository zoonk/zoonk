defmodule ZoonkDev.Live.UIHome do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article>
      <.text tag="h1" size={:header}>UI Playground</.text>

      <.text size={:body}>
        This is a playground for testing and experimenting with the UI components.
      </.text>

      <.text size={:body}>
        You can use this space to test different components and their configurations.
      </.text>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, "UI Playground")

    {:ok, socket}
  end
end
