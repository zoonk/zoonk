defmodule ZoonkWeb.Hooks.Admin do
  @moduledoc """
  LiveView hooks for ensuring admin access.
  """
  use ZoonkWeb, :verified_routes

  alias Zoonk.Admin
  alias Zoonk.Scope

  @doc """
  Makes sure the user is an admin during mounting.
  """
  def on_mount(:ensure_user_admin, _params, _session, socket) do
    user = Scope.get_user(socket.assigns.current_scope)

    if Admin.admin?(user) do
      {:cont, socket}
    else
      {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/")}
    end
  end
end
