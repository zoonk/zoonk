defmodule ZoonkWeb.AdminUser do
  @moduledoc """
  Plugs and LiveView hooks for ensuring admin access.
  """
  use ZoonkWeb, :verified_routes

  import Phoenix.Controller
  import Plug.Conn

  alias Zoonk.Admin
  alias Zoonk.Scope

  @doc """
  Makes sure the user is an admin during mounting.
  """
  def on_mount(:ensure_user_admin, _params, _session, socket) do
    user = Scope.get_user(socket.assigns.current_scope)

    if Admin.admin_user?(user) do
      {:cont, Phoenix.Component.assign(socket, search_link: nil)}
    else
      {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/")}
    end
  end

  @doc """
  Checks if the current user is an admin.

  It allows access to the route if the user is an admin.
  If the user is not an admin, it redirects to the home page.
  """
  def require_admin_user(%Plug.Conn{assigns: assigns} = conn, _opts) do
    user = Scope.get_user(assigns.current_scope)
    admin_user? = Admin.admin_user?(user)
    require_admin_user(conn, assigns, admin_user?)
  end

  defp require_admin_user(conn, _opts, true), do: conn

  defp require_admin_user(conn, _opts, false) do
    conn
    |> redirect(to: ~p"/")
    |> halt()
  end
end
