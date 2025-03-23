defmodule ZoonkWeb.Library.LibraryHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("content", "Library"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render
      scope={@current_scope}
      flash={@flash}
      page_title={@page_title}
      active_page={:library}
    >
      placeholder for library
    </ZoonkWeb.AppLayout.render>
    """
  end
end
