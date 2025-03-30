defmodule ZoonkWeb.UserAuthorization do
  @moduledoc """
  Authorization plugs for web routes.

  This module contains plugs that check if a user has permission to access
  certain routes based on their organization membership, status, and role.
  """
  use ZoonkWeb, :verified_routes
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Accounts.User
  alias Zoonk.Scope
  alias ZoonkWeb.PermissionError

  @admin_paths ["/editor", "/org"]

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

  defp require_org_member(_conn, _opts, false) do
    raise PermissionError, code: :require_org_member
  end

  @doc """
  Checks if the user is an admin of the current organization for admin-restricted paths.

  This plug verifies that the user has an admin role in the organization when
  accessing paths that start with "/editor" or "/org". This check applies to all
  organization kinds.

  ## Examples

      plug :require_org_admin
  """

  def require_org_admin(conn, []) do
    require_org_admin(conn,
      admin_path?: admin_path?(conn.request_path),
      org_admin?: org_admin?(conn.assigns.current_scope)
    )
  end

  def require_org_admin(conn, admin_path?: true, org_admin?: true), do: conn

  def require_org_admin(_conn, admin_path?: true, org_admin?: false) do
    raise PermissionError, code: :require_org_admin
  end

  def require_org_admin(conn, _opts), do: conn

  @doc """
  LiveView hooks to check organization membership and admin permissions.

  ## `on_mount` arguments

    * `:ensure_org_member` - Verifies that either:
      1. The user is a confirmed member of the organization
      2. OR the organization is public (`:app` or `:creator` kind)
      If not, raises a PermissionError.

    * `:ensure_org_admin` - Verifies that the user has an admin role
      in the organization when accessing paths that start with "/editor"
      or "/org". This check applies to all organization kinds.

  ## Examples

      on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
      on_mount {ZoonkWeb.UserAuthorization, :ensure_org_admin}
  """
  def on_mount(:ensure_org_member, _params, _session, socket)
      when socket.assigns.current_scope.org.kind in [:app, :creator] do
    {:cont, socket}
  end

  def on_mount(:ensure_org_member, _params, _session, socket) do
    if org_member?(socket.assigns.current_scope) do
      {:cont, socket}
    else
      raise PermissionError, code: :require_org_member
    end
  end

  def on_mount(:ensure_org_admin, _params, _session, socket) do
    path = Phoenix.LiveView.get_connect_info(socket, :uri).path
    on_mount_admin(socket, admin_path?: admin_path?(path), org_admin?: org_admin?(socket.assigns.current_scope))
  end

  defp on_mount_admin(socket, admin_path?: true, org_admin?: true), do: {:cont, socket}

  defp on_mount_admin(_socket, admin_path?: true, org_admin?: false) do
    raise PermissionError, code: :require_org_admin
  end

  defp on_mount_admin(socket, _opts), do: {:cont, socket}

  defp org_member?(%Scope{user: %User{confirmed_at: nil}}), do: false
  defp org_member?(%Scope{org_member: nil}), do: false
  defp org_member?(_scope), do: true

  defp org_admin?(%Scope{user: %User{confirmed_at: nil}}), do: false
  defp org_admin?(%Scope{org_member: nil}), do: false
  defp org_admin?(%Scope{org_member: org_member}) when org_member.role == :admin, do: true
  defp org_admin?(_scope), do: false

  defp admin_path?(path) do
    Enum.any?(@admin_paths, &String.starts_with?(path, &1))
  end
end
