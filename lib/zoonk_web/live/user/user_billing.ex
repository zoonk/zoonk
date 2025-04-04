defmodule ZoonkWeb.User.UserBillingLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.UserLayout.render
      scope={@scope}
      flash={@flash}
      page_title={@page_title}
      active_page={:billing}
    >
      placeholder for billing
    </ZoonkWeb.UserLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("users", "Billing"))
    {:ok, socket}
  end
end
