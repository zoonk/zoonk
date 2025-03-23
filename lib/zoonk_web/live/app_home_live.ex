defmodule ZoonkWeb.AppHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render
      flash={@flash}
      scope={@current_scope}
      page_title={@page_title}
      active_page={:app_home}
    >
      placeholder for app home
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("content", "Summary"))

    {:ok, socket}
  end
end
