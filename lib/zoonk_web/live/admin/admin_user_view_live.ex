defmodule ZoonkWeb.Admin.AdminUserViewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts.User
  alias Zoonk.Admin

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <div>{@page_title}</div>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, assign(socket, back: %{link: ~p"/admin/users", label: dgettext("admin", "users")})}
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
