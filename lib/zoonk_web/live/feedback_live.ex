defmodule ZoonkWeb.FeedbackLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main>
      send feedback placeholder
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("users", "Send feedback"))
    {:ok, socket}
  end
end
