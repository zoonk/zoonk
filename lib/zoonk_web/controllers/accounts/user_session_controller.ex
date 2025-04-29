defmodule ZoonkWeb.Accounts.UserSessionController do
  @moduledoc """
  Handles user sessions.

  Provides actions for logging in users via an OTP code
  and logging out users.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Accounts
  alias ZoonkWeb.UserAuth

  @doc """
  Logs in a user.

  The user is redirected to the home page upon successful
  authentication or to the login page with an error message.

  This controller is also used for confirming a user.
  """
  def create(conn, params) do
    create(conn, params, nil)
  end

  # OTP login
  defp create(conn, %{"user" => %{"code" => otp}}, info) do
    case Accounts.login_user_by_otp(otp) do
      {:ok, user, tokens_to_disconnect} ->
        UserAuth.disconnect_sessions(tokens_to_disconnect)

        conn
        |> put_flash(:info, info)
        |> UserAuth.login_user(user)

      _error ->
        conn
        |> put_flash(:error, expired_code())
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
  def confirm(conn, %{"code" => otp}), do: login_user(conn, otp, :confirm)

  @doc """
  Signs in a user via an OTP code sent to their email.
  """
  def login(conn, %{"code" => otp}), do: login_user(conn, otp, :login)

  defp login_user(conn, otp_code, action) do
    if Accounts.get_user_by_otp_code(otp_code) do
      create(conn, %{"user" => %{"code" => otp_code}}, login_flash(action))
    else
      conn
      |> put_flash(:error, expired_code())
      |> redirect(to: ~p"/login/email")
    end
  end

  defp login_flash(:confirm), do: dgettext("users", "User confirmed successfully.")
  defp login_flash(:login), do: nil

  defp expired_code, do: dgettext("users", "Code is invalid or it has expired.")
end
