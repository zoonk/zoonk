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

  @doc """
  LiveView hooks to check organization membership and admin permissions.

  ## `on_mount` arguments

    * `:ensure_org_member` - Verifies that either:
      1. The user is a confirmed member of the organization
      2. OR the organization is public (`:app` or `:creator` kind)
      If not, raises a PermissionError.

  ## Examples

      on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
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

  defp org_member?(%Scope{user: %User{confirmed_at: nil}}), do: false
  defp org_member?(%Scope{org_member: nil}), do: false
  defp org_member?(_scope), do: true
end
