defmodule ZoonkWeb.UserSessionControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias Zoonk.Repo

  describe "POST /confirm?_action=login" do
    setup do
      %{user: user_fixture()}
    end

    test "logs the user in", %{conn: conn, user: user} do
      otp_code = generate_user_otp_code(user)

      params = %{"_action" => "login", "user" => %{"code" => otp_code, "email" => user.email}}
      post_conn = post(conn, ~p"/confirm", params)

      assert get_session(post_conn, :user_token)
      assert Repo.get!(User, user.id).confirmed_at == user.confirmed_at
      assert redirected_to(post_conn) == ~p"/"
      assert is_nil(Phoenix.Flash.get(post_conn.assigns.flash, :info))

      # Now do a logged in request and assert on the menu
      loggedin_conn = get(post_conn, ~p"/")
      html_response(loggedin_conn, 200)
    end

    test "redirects back to the code page when OTP code is invalid", %{conn: conn, user: user} do
      params = %{"_action" => "login", "user" => %{"code" => "invalid_code", "email" => user.email}}
      conn = post(conn, ~p"/confirm", params)
      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "Invalid code or account not found."
      assert redirected_to(conn) == ~p"/confirm/login"
    end
  end

  describe "POST /confirm?_action=signup" do
    setup do
      %{unconfirmed_user: unconfirmed_user_fixture(), user: user_fixture()}
    end

    test "confirms the given code once", %{conn: conn, unconfirmed_user: user} do
      code = extract_otp_code(Accounts.deliver_login_instructions(user))

      params = %{"_action" => "signup", "user" => %{"code" => code, "email" => user.email}}
      post_conn = post(conn, ~p"/confirm", params)

      assert Repo.get!(User, user.id).confirmed_at
      assert Phoenix.Flash.get(post_conn.assigns.flash, :info) =~ "Your account is confirmed!"

      # we are logged in now
      assert redirected_to(post_conn) == ~p"/"
      assert get_session(post_conn, :user_token)

      # logs out when trying to confirm again
      logout_conn = post(build_conn(), ~p"/confirm", params)
      assert redirected_to(logout_conn) == ~p"/confirm/signup"
      assert Phoenix.Flash.get(logout_conn.assigns.flash, :error) =~ "Invalid code or account not found."
      refute get_session(logout_conn, :user_token)
    end

    test "redirects back to the code page if the code is invalid", %{conn: conn, user: user} do
      params = %{"_action" => "signup", "user" => %{"code" => "invalid_code", "email" => user.email}}
      conn = post(conn, ~p"/confirm", params)
      assert redirected_to(conn) == ~p"/confirm/signup"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Invalid code or account not found."
    end
  end

  describe "POST /confirm?_action=email" do
    setup %{conn: conn} do
      user = user_fixture()
      email = unique_user_email()

      otp_code = extract_otp_code(Accounts.deliver_user_update_email_instructions(%{user | email: email}, user.email))

      %{conn: login_user(conn, user), otp_code: otp_code, email: email, user: user}
    end

    test "updates the user email once", %{conn: conn, user: user, otp_code: otp_code, email: email} do
      params = %{"_action" => "email", "user" => %{"code" => otp_code}}
      post_conn = post(conn, ~p"/confirm", params)

      assert redirected_to(post_conn) == ~p"/email"
      assert Phoenix.Flash.get(post_conn.assigns.flash, :info) =~ "Email changed successfully."

      refute Accounts.get_user_by_email(user.email)
      assert Accounts.get_user_by_email(email).confirmed_at

      # don't allow to use the same OTP code again
      updated_conn = post(conn, ~p"/confirm", params)
      assert redirected_to(updated_conn) == ~p"/email"
      assert Phoenix.Flash.get(updated_conn.assigns.flash, :error) =~ "Code is invalid or it has expired."
    end

    test "doesn't update email with invalid code", %{conn: conn, user: user} do
      params = %{"_action" => "email", "user" => %{"code" => "invalid_code"}}
      post_conn = post(conn, ~p"/confirm", params)

      assert redirected_to(post_conn) == ~p"/email"
      assert Phoenix.Flash.get(post_conn.assigns.flash, :error) =~ "Code is invalid or it has expired."
      assert Accounts.get_user_by_email(user.email)
    end
  end

  describe "DELETE /logout" do
    setup do
      %{user: user_fixture()}
    end

    test "logs the user out", %{conn: conn, user: user} do
      conn =
        conn
        |> login_user(user)
        |> delete(~p"/logout")

      assert redirected_to(conn) == ~p"/catalog"
      refute get_session(conn, :user_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end

    test "succeeds even if the user is not logged in", %{conn: conn} do
      conn = delete(conn, ~p"/logout")
      assert redirected_to(conn) == ~p"/catalog"
      refute get_session(conn, :user_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end
  end
end
