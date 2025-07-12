defmodule ZoonkWeb.UserAuthorization do
  @moduledoc """
  Authorization plugs for web routes.

  This module contains plugs that check if a user has permission to access
  certain routes based on their organization membership, status, and role.
  """
  use ZoonkWeb, :verified_routes
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Accounts.User
  alias Zoonk.Helpers
  alias Zoonk.Scope
  alias ZoonkWeb.PermissionError

  @admin_contexts [:editor, :org]

  @doc """
  LiveView hooks to check organization membership and admin permissions.

  ## `on_mount` arguments

    * `:ensure_org_member` - Verifies that either:
      1. The user is a confirmed member of the organization
      2. OR the organization is public (`:app` or `:creator` kind)
      If not, raises a PermissionError.

    * `:ensure_org_admin` - Verifies that the user has an admin role
      in the organization when accessing paths that start with a value from `@admin_paths`.
      This check applies to all organization kinds.

  ## Examples

      on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
      on_mount {ZoonkWeb.UserAuthorization, :ensure_org_admin}
  """
  def on_mount(:ensure_org_member, _params, _session, socket)
      when is_nil(socket.assigns.scope) or is_nil(socket.assigns.scope.user) do
    {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/login")}
  end

  def on_mount(:ensure_org_member, _params, _session, socket) do
    if org_member?(socket.assigns.scope) do
      {:cont, socket}
    else
      raise PermissionError, code: :require_org_member
    end
  end

  def on_mount(:ensure_org_admin, _params, _session, socket) do
    context = Helpers.get_context_from_module(socket.view)
    on_mount_admin(socket, admin_path?: admin_context?(context), org_admin?: org_admin?(socket.assigns.scope))
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

  defp admin_context?(nil), do: false

  defp admin_context?(context) do
    Enum.member?(@admin_contexts, context)
  end
end
