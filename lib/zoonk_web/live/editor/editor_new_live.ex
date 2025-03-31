defmodule ZoonkWeb.Editor.EditorNewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.EditorLayout.render
      scope={@scope}
      flash={@flash}
      page_title={@page_title}
      active_page={:new}
    >
      placeholder for adding a new track or course
    </ZoonkWeb.EditorLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("editor", "Create a track or course"))
    {:ok, socket}
  end
end
