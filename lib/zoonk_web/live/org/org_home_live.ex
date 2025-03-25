defmodule ZoonkWeb.Org.OrgHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render
      scope={@current_scope}
      flash={@flash}
      page_title={@page_title}
      active_page={:org}
    >
      placeholder for org overview
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("orgs", "Overview"))
    {:ok, socket}
  end
end
