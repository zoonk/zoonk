defmodule ZoonkWeb.Plugs.UserAuth do
  @moduledoc """
  Handles user authentication.

  This module provides functions to sign users in and out,
  manage session tokens, and connect LiveViews with the
  authenticated user context.

  It renews sessions to mitigate fixation attacks, sets
  persistent cookies for "remember me" functionality, and
  supports secure disconnection of LiveView sessions.
  """
  use ZoonkWeb, :verified_routes

  import Phoenix.Controller
  import Plug.Conn

  alias Zoonk.Auth
  alias Zoonk.Configuration
  alias ZoonkWeb.Helpers

  @remember_me_cookie Configuration.get_remember_me_cookie_name()

  @doc """
  Authenticates the user by looking into the session
  and remember me token.
  """
  def fetch_current_user(conn, _opts) do
    {user_token, conn} = ensure_user_token(conn)
    user = user_token && Auth.get_user_by_session_token(user_token)
    assign(conn, :current_user, user)
  end

  defp ensure_user_token(conn) do
    if token = get_session(conn, :user_token) do
      {token, conn}
    else
      conn = fetch_cookies(conn, signed: [@remember_me_cookie])

      if token = conn.cookies[@remember_me_cookie] do
        {token, Helpers.UserAuth.put_token_in_session(conn, token)}
      else
        {nil, conn}
      end
    end
  end

  @doc """
  Used for routes that require the user to be authenticated.

  If you want to enforce the user email is confirmed before
  they use the application at all, here would be a good place.
  """
  def require_authenticated_user(conn, _opts) do
    if conn.assigns[:current_user] do
      conn
    else
      conn
      |> put_flash(:error, "You must log in to access this page.")
      |> maybe_store_return_to()
      |> redirect(to: ~p"/users/signin")
      |> halt()
    end
  end

  defp maybe_store_return_to(%{method: "GET"} = conn) do
    put_session(conn, :user_return_to, current_path(conn))
  end

  defp maybe_store_return_to(conn), do: conn
end
