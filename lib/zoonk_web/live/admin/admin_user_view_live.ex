defmodule ZoonkWeb.Admin.AdminUserViewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts.User
  alias Zoonk.Admin

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.Admin.AdminLayout.render
      flash={@flash}
      back={%{link: ~p"/admin/users", label: dgettext("admin", "users")}}
      page_title={@page_title}
      active_page={:users}
    >
      {@page_title}
    </ZoonkWeb.Admin.AdminLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_params(params, _uri, socket) do
    user = Admin.get_user(params["id"])

    socket =
      socket
      |> assign(:user, user)
      |> assign(:page_title, User.get_display_name(user.profile))

    {:noreply, socket}
  end
end
