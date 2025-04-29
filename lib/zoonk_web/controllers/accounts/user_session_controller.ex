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
  def create(conn, %{"user" => %{"code" => otp}, "_action" => action}) do
    case Accounts.login_user_by_otp(otp) do
      {:ok, user, tokens_to_disconnect} ->
        UserAuth.disconnect_sessions(tokens_to_disconnect)

        conn
        |> put_flash(:info, confirmation_msg(action))
        |> UserAuth.login_user(user)

      _error ->
        conn
        |> put_flash(:error, dgettext("users", "Invalid code or account not found."))
        |> redirect(to: error_redirect(action))
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

  defp confirmation_msg("signup"), do: dgettext("users", "Your account is confirmed!")
  defp confirmation_msg(_action), do: nil

  defp error_redirect("login"), do: ~p"/login/code"
  defp error_redirect("signup"), do: ~p"/signup/code"
end
