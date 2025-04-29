defmodule ZoonkWeb.Accounts.UserSessionControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias Zoonk.Repo

  describe "POST /login?_action=login" do
    setup do
      %{user: user_fixture()}
    end

    test "logs the user in", %{conn: conn, user: user} do
      {otp_code, _hashed_token} = generate_user_otp_code(user)

      params = %{"_action" => "login", "user" => %{"code" => otp_code}}
      post_conn = post(conn, ~p"/login", params)

      assert get_session(post_conn, :user_token)
      assert Repo.get!(User, user.id).confirmed_at == user.confirmed_at
      assert redirected_to(post_conn) == ~p"/"
      assert is_nil(Phoenix.Flash.get(post_conn.assigns.flash, :info))

      # Now do a logged in request and assert on the menu
      loggedin_conn = get(post_conn, ~p"/")
      html_response(loggedin_conn, 200)
    end

    test "redirects back to the code page when OTP code is invalid", %{conn: conn} do
      params = %{"_action" => "login", "user" => %{"code" => "invalid_code"}}
      conn = post(conn, ~p"/login", params)
      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "Invalid code or account not found."
      assert redirected_to(conn) == ~p"/login/code"
    end
  end

  describe "POST /login?_action=signup" do
    setup do
      %{unconfirmed_user: unconfirmed_user_fixture(), user: user_fixture()}
    end

    test "confirms the given code once", %{conn: conn, unconfirmed_user: user} do
      code = extract_user_otp_code(fn url -> Accounts.deliver_login_instructions(user, url) end)

      params = %{"_action" => "signup", "user" => %{"code" => code}}
      post_conn = post(conn, ~p"/login", params)

      assert Repo.get!(User, user.id).confirmed_at
      assert Phoenix.Flash.get(post_conn.assigns.flash, :info) =~ "Your account is confirmed!"

      # we are logged in now
      assert redirected_to(conn) == ~p"/"
      assert get_session(conn, :user_token)

      # logs out when trying to confirm again
      logout_conn = post(build_conn(), ~p"/login", params)
      assert redirected_to(logout_conn) == ~p"/login/signup"
      assert Phoenix.Flash.get(logout_conn.assigns.flash, :error) =~ "Invalid code or account not found."
      refute get_session(logout_conn, :user_token)
    end

    test "redirects back to the code page if the code is invalid", %{conn: conn} do
      params = %{"_action" => "signup", "user" => %{"code" => "invalid_code"}}
      conn = post(conn, ~p"/login", params)
      assert redirected_to(conn) == ~p"/signup/code"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Invalid code or account not found."
    end
  end

  describe "DELETE /logout" do
    test "logs the user out", %{conn: conn, user: user} do
      conn =
        conn
        |> login_user(user)
        |> delete(~p"/logout")

      assert redirected_to(conn) == ~p"/"
      refute get_session(conn, :user_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end

    test "succeeds even if the user is not logged in", %{conn: conn} do
      conn = delete(conn, ~p"/logout")
      assert redirected_to(conn) == ~p"/"
      refute get_session(conn, :user_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end
  end
end
