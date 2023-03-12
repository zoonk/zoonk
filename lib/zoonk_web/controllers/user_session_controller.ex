defmodule ZoonkWeb.UserSessionController do
  use ZoonkWeb, :controller

  alias Zoonk.Accounts
  alias ZoonkWeb.UserAuth

  def create(conn, %{"_action" => "registered"} = params) do
    create(conn, params, "Account created successfully!")
  end

  def create(conn, %{"_action" => "password_updated"} = params) do
    conn
    |> put_session(:user_return_to, ~p"/users/settings")
    |> create(params, "Password updated successfully!")
  end

  def create(conn, params) do
    create(conn, params, "Welcome back!")
  end

  defp create(conn, %{"user" => user_params}, info) do
    email_or_username =
      case user_params do
        %{"email_or_username" => email_or_username} -> email_or_username
        %{"email" => email} -> email
      end

    password = user_params["password"]

    if user = Accounts.get_user_by_email_or_username_and_password(email_or_username, password) do
      conn
      |> put_flash(:info, info)
      |> UserAuth.log_in_user(user, user_params)
    else
      # In order to prevent user enumeration attacks, don't disclose whether the email is registered.
      conn
      |> put_flash(:error, "Invalid email/username or password")
      |> put_flash(:email_or_username, String.slice(email_or_username, 0, 160))
      |> redirect(to: ~p"/users/log_in")
    end
  end

  def delete(conn, _params) do
    conn
    |> put_flash(:info, "Logged out successfully.")
    |> UserAuth.log_out_user()
  end
end
