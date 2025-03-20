defmodule ZoonkDev.Live.UIAnchor do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article>anchor component</article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Anchor")
    {:ok, socket}
  end
end
