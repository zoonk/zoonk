defmodule ZoonkWeb.Controller.UserSession do
  @moduledoc false
  use ZoonkWeb, :controller

  alias Zoonk.Auth
  alias ZoonkWeb.UserAuth

  def create(conn, %{"_action" => "confirmed"} = params) do
    create(conn, params, "User confirmed successfully.")
  end

  def create(conn, params) do
    create(conn, params, "Welcome back!")
  end

  # magic link signin
  defp create(conn, %{"user" => %{"token" => token}}, info) do
    case Auth.signin_user_by_magic_link(token) do
      {:ok, user, tokens_to_disconnect} ->
        UserAuth.disconnect_sessions(tokens_to_disconnect)

        conn
        |> put_flash(:info, info)
        |> UserAuth.signin_user(user)

      _error ->
        conn
        |> put_flash(:error, "The link is invalid or it has expired.")
        |> redirect(to: ~p"/users/signin")
    end
  end

  def delete(conn, _params) do
    conn
    |> put_flash(:info, "Logged out successfully.")
    |> UserAuth.signout_user()
  end
end
