defmodule ZoonkWeb.Hooks.UserAuth do
  @moduledoc """
  LiveView hooks for mounting and enforcing user authentication.

  Use this module within LiveViews or live sessions to either
  mount the current user without enforcing authentication
  or to enforce user authentication by redirecting
  unauthenticated users to the sign-in page.
  """
  use ZoonkWeb, :verified_routes

  alias Zoonk.Auth

  @doc """
  Handles mounting and authenticating the current_user in LiveViews.

  ## `on_mount` arguments

    * `:mount_current_user` - Assigns current_user
      to socket assigns based on user_token, or nil if
      there's no user_token or no matching user.

    * `:ensure_authenticated` - Authenticates the user from the session,
      and assigns the current_user to socket assigns based
      on user_token.
      Redirects to signin page if there's no logged user.

    * `:ensure_sudo_mode` - Check if the user has been authenticated
      recently enough to access to a certain page.

  ## Examples

  Use the `on_mount` lifecycle macro in LiveViews to mount or authenticate
  the current_user:

      defmodule ZoonkWeb.PageLive do
        use ZoonkWeb, :live_view

        on_mount {ZoonkWeb.Hooks.UserAuth, :mount_current_user}
        ...
      end

  Or use the `live_session` of your router to invoke the on_mount callback:

      live_session :authenticated, on_mount: [{ZoonkWeb.Hooks.UserAuth, :ensure_authenticated}] do
        live "/profile", ProfileLive, :index
      end
  """
  def on_mount(:mount_current_user, _params, session, socket) do
    {:cont, mount_current_user(socket, session)}
  end

  def on_mount(:ensure_authenticated, _params, session, socket) do
    socket = mount_current_user(socket, session)

    if socket.assigns.current_user do
      {:cont, socket}
    else
      socket =
        socket
        |> Phoenix.LiveView.put_flash(:error, "You must log in to access this page.")
        |> Phoenix.LiveView.redirect(to: ~p"/login")

      {:halt, socket}
    end
  end

  def on_mount(:ensure_sudo_mode, _params, session, socket) do
    socket = mount_current_user(socket, session)

    if Auth.sudo_mode?(socket.assigns.current_user, -10) do
      {:cont, socket}
    else
      socket =
        socket
        |> Phoenix.LiveView.put_flash(:error, "You must re-authenticate to access this page.")
        |> Phoenix.LiveView.redirect(to: ~p"/login")

      {:halt, socket}
    end
  end

  defp mount_current_user(socket, session) do
    Phoenix.Component.assign_new(socket, :current_user, fn ->
      if user_token = session["user_token"] do
        Auth.get_user_by_session_token(user_token)
      end
    end)
  end
end
