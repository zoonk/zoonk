defmodule ZoonkWeb.Editor.EditorHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.EditorLayout.render
      scope={@current_scope}
      flash={@flash}
      page_title={@page_title}
      active_page={:home}
    >
      placeholder for editor
    </ZoonkWeb.EditorLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("editor", "Editor"))
    {:ok, socket}
  end
end
