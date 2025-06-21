defmodule ZoonkWeb.EmailLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main>
      change email placeholder
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("users", "Change email"))
    {:ok, socket}
  end
end
