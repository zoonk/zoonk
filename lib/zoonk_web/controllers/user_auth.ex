defmodule ZoonkWeb.Controllers.UserAuth do
  @moduledoc """
  Handles user authentication.

  Provides actions for signing in users via a magic link
  and signing out users.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Auth
  alias ZoonkWeb.Helpers

  @doc """
  Signs in a user.

  The user is redirected to the home page upon successful
  authentication or to the sign-in page with an error message.

  This controller is also used for confirming a user.
  """
  def create(conn, params) do
    create(conn, params, nil)
  end

  # magic link signin
  defp create(conn, %{"user" => %{"token" => token}}, info) do
    case Auth.signin_user_by_magic_link(token) do
      {:ok, user, tokens_to_disconnect} ->
        Helpers.UserAuth.disconnect_sessions(tokens_to_disconnect)

        conn
        |> put_flash(:info, info)
        |> Helpers.UserAuth.signin_user(user)

      _error ->
        conn
        |> put_flash(:error, "The link is invalid or it has expired.")
        |> redirect(to: ~p"/login/email")
    end
  end

  @doc """
  Signs out a user.
  """
  def delete(conn, _params) do
    conn
    |> put_flash(:info, "Logged out successfully.")
    |> Helpers.UserAuth.signout_user()
  end

  @doc """
  Confirms a user account.
  """
  def confirm(conn, %{"token" => token}) do
    if Auth.get_user_by_magic_link_token(token) do
      create(conn, %{"user" => %{"token" => token}}, "User confirmed successfully.")
    else
      conn
      |> put_flash(:error, "Magic link is invalid or it has expired.")
      |> redirect(to: ~p"/login/email")
    end
  end
end
