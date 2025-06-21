defmodule ZoonkWeb.NameLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main>
      display name placeholder
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("users", "Display name"))
    {:ok, socket}
  end
end
