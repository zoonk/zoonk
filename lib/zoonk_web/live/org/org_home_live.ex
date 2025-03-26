defmodule ZoonkWeb.Org.OrgHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.OrgLayout.render
      scope={@current_scope}
      flash={@flash}
      page_title={@page_title}
      active_page={:home}
    >
      placeholder for org overview
    </ZoonkWeb.OrgLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("orgs", "Overview"))
    {:ok, socket}
  end
end
