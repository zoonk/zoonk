defmodule ZoonkWeb.Accounts.UserSessionController do
  @moduledoc """
  Handles user sessions.

  Provides actions for logging in users via a magic link
  and logging out users.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Accounts
  alias ZoonkWeb.Accounts.UserAuth

  @doc """
  Logs in a user.

  The user is redirected to the home page upon successful
  authentication or to the login page with an error message.

  This controller is also used for confirming a user.
  """
  def create(conn, params) do
    create(conn, params, nil)
  end

  # magic link login
  defp create(conn, %{"user" => %{"token" => token}}, info) do
    case Accounts.login_user_by_magic_link(token) do
      {:ok, user, tokens_to_disconnect} ->
        UserAuth.disconnect_sessions(tokens_to_disconnect)

        conn
        |> put_flash(:info, info)
        |> UserAuth.login_user(user)

      _error ->
        conn
        |> put_flash(:error, expired_link())
        |> redirect(to: ~p"/login/email")
    end
  end

  @doc """
  Logs out a user.
  """
  def delete(conn, _params) do
    conn
    |> put_flash(:info, dgettext("users", "Logged out successfully."))
    |> UserAuth.logout_user()
  end

  @doc """
  Confirms a user account.
  """
  def confirm(conn, %{"token" => token}), do: login_user(conn, token, :confirm)

  @doc """
  Signs in a user via a magic link token sent to their email.
  """
  def login(conn, %{"token" => token}), do: login_user(conn, token, :login)

  defp login_user(conn, token, action) do
    if Accounts.get_user_by_magic_link_token(token) do
      create(conn, %{"user" => %{"token" => token}}, login_flash(action))
    else
      conn
      |> put_flash(:error, expired_link())
      |> redirect(to: ~p"/login/email")
    end
  end

  defp login_flash(:confirm), do: dgettext("users", "User confirmed successfully.")
  defp login_flash(:login), do: nil

  defp expired_link, do: dgettext("users", "Magic link is invalid or it has expired.")
end
