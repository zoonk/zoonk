defmodule ZoonkWeb.Org.OrgMembersLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render
      scope={@current_scope}
      flash={@flash}
      page_title={@page_title}
      active_page={:org_members}
    >
      placeholder for team members
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("orgs", "Team Members"))
    {:ok, socket}
  end
end
