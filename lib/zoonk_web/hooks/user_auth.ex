defmodule ZoonkWeb.Hooks.UserAuth do
  @moduledoc """
  LiveView hooks for mounting and enforcing user authentication.

  Use this module within LiveViews or live sessions to either
  mount the current user without enforcing authentication
  or to enforce user authentication by redirecting
  unauthenticated users to the login page.
  """
  use ZoonkWeb, :verified_routes

  alias Zoonk.Accounts
  alias Zoonk.Scope

  @doc """
  Handles mounting and authenticating the current_scope in LiveViews.

  ## `on_mount` arguments

    * `:mount_current_scope` - Assigns current_scope
      to socket assigns based on user_token, or nil if
      there's no user_token or no matching user.

    * `:ensure_authenticated` - Authenticates the user from the session,
      and assigns the current_scope to socket assigns
      based on user_token. Redirects to login page if there's no logged user.

    * `:ensure_sudo_mode` - Check if the user has been authenticated
      recently enough to access a certain page.

  ## Examples

  Use the `on_mount` lifecycle macro in LiveViews to mount or authenticate
  the current_scope:

      defmodule ZoonkWeb.PageLive do
        use ZoonkWeb, :live_view

        on_mount {ZoonkWeb.Hooks.UserAuth, :mount_current_scope}
        ...
      end

  Or use the `live_session` of your router to invoke the on_mount callback:

      live_session :authenticated, on_mount: [{ZoonkWeb.Hooks.UserAuth, :ensure_authenticated}] do
        live "/profile", ProfileLive, :index
      end
  """
  def on_mount(:mount_current_scope, _params, session, socket) do
    {:cont, mount_current_scope(socket, session)}
  end

  def on_mount(:ensure_authenticated, params, session, socket) do
    socket = mount_current_scope(socket, session)
    user_return_to = Map.get(params, "redirect_to") || ~p"/"

    if socket.assigns.current_scope && socket.assigns.current_scope.user_identity do
      {:cont, Phoenix.Component.assign(socket, :user_return_to, user_return_to)}
    else
      socket =
        socket
        |> Phoenix.LiveView.put_flash(:error, dgettext("users", "You must log in to access this page."))
        |> Phoenix.LiveView.redirect(to: ~p"/login")

      {:halt, socket}
    end
  end

  def on_mount(:ensure_sudo_mode, _params, session, socket) do
    socket = mount_current_scope(socket, session)

    if Accounts.sudo_mode?(socket.assigns.current_scope.user_identity) do
      {:cont, socket}
    else
      socket =
        socket
        |> Phoenix.LiveView.put_flash(:error, dgettext("users", "You need to reauthenticate to access this page."))
        |> Phoenix.LiveView.redirect(to: ~p"/login")

      {:halt, socket}
    end
  end

  defp mount_current_scope(socket, session) do
    Phoenix.Component.assign_new(socket, :current_scope, fn ->
      user_identity =
        if user_token = session["user_token"] do
          Accounts.get_user_identity_by_session_token(user_token)
        end

      Scope.for_user(user_identity)
    end)
  end
end
