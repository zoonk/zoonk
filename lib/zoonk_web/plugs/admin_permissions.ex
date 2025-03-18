defmodule ZoonkWeb.Plugs.Admin do
  @moduledoc """
  Plug for enforcing admin permissions.
  """
  use ZoonkWeb, :verified_routes

  import Phoenix.Controller
  import Plug.Conn

  alias Zoonk.Admin
  alias Zoonk.Scope

  @doc """
  Checks if the current user is an admin.

  It allows access to the route if the user is an admin.
  If the user is not an admin, it redirects to the home page.
  """
  def require_admin_user(%Plug.Conn{assigns: assigns} = conn, _opts) do
    user = Scope.get_user(assigns.current_scope)
    admin? = Admin.admin?(user)
    require_admin_user(conn, assigns, admin?)
  end

  defp require_admin_user(conn, _opts, true), do: conn

  defp require_admin_user(conn, _opts, false) do
    conn
    |> redirect(to: ~p"/")
    |> halt()
  end
end
