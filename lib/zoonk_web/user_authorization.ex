defmodule ZoonkWeb.UserAuthorization do
  @moduledoc """
  Authorization plugs for web routes.

  This module contains plugs that check if a user has permission to access
  certain routes based on their organization membership and status.
  """
  use Gettext, backend: Zoonk.Gettext

  import Phoenix.Controller
  import Plug.Conn

  alias Zoonk.Accounts.User
  alias Zoonk.Scope
  alias ZoonkWeb.Accounts.UserAuth

  @doc """
  Checks if the user is a confirmed member of the current organization.

  This plug verifies that either:
  1. The user is a confirmed member of the organization
  2. OR the organization is public (`:app` or `:creator` kind)

  If not, then we log them out.

  ## Examples

      plug :require_org_member
  """
  def require_org_member(conn, _opts) when conn.assigns.current_scope.org.kind in [:app, :creator], do: conn
  def require_org_member(conn, opts), do: require_org_member(conn, opts, org_member?(conn.assigns.current_scope))

  defp require_org_member(conn, _opts, true), do: conn

  defp require_org_member(conn, _opts, false) do
    conn
    |> put_flash(:error, dgettext("errors", "You must be a member of this organization."))
    |> UserAuth.logout_user()
    |> halt()
  end

  defp org_member?(%Scope{user: %User{confirmed_at: nil}}), do: false
  defp org_member?(%Scope{org_member: nil}), do: false
  defp org_member?(_scope), do: true
end
