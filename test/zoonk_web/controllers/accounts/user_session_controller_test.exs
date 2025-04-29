defmodule ZoonkWeb.Accounts.UserSessionControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias Zoonk.Repo

  setup do
    %{unconfirmed_user: unconfirmed_user_fixture(), user: user_fixture()}
  end

  describe "POST /login - OTP code" do
    test "logs the user in", %{conn: conn, user: user} do
      {otp_code, _hashed_token} = generate_user_otp_code(user)

      post_conn = post(conn, ~p"/login", %{"user" => %{"code" => otp_code}})

      assert get_session(post_conn, :user_token)
      assert redirected_to(post_conn) == ~p"/"

      # Now do a logged in request and assert on the menu
      loggedin_conn = get(post_conn, ~p"/")
      html_response(loggedin_conn, 200)
    end

    test "redirects to login page when OTP code is invalid", %{conn: conn} do
      conn = post(conn, ~p"/login", %{"user" => %{"code" => "invalid"}})
      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "Code is invalid or it has expired."
      assert redirected_to(conn) == ~p"/login/email"
    end
  end

  describe "GET /confirm/:code" do
    test "confirms the given code once", %{conn: conn, unconfirmed_user: user} do
      code = extract_user_otp_code(fn url -> Accounts.deliver_login_instructions(user, url) end)

      conn = get(conn, ~p"/confirm/#{code}")

      assert Repo.get!(User, user.id).confirmed_at
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "User confirmed successfully."

      # we are logged in now
      assert redirected_to(conn) == ~p"/"
      assert get_session(conn, :user_token)

      # log out, new conn
      logout_conn = get(build_conn(), ~p"/confirm/#{code}")
      assert redirected_to(logout_conn) == ~p"/login/email"
      assert Phoenix.Flash.get(logout_conn.assigns.flash, :error) =~ "Code is invalid or it has expired."
      refute get_session(logout_conn, :user_token)
    end

    test "logs confirmed user in without changing confirmed_at", %{conn: conn, user: user} do
      code = extract_user_otp_code(fn url -> Accounts.deliver_login_instructions(user, url) end)
      conn = get(conn, ~p"/login/t/#{code}")

      assert get_session(conn, :user_token)
      assert Repo.get!(User, user.id).confirmed_at == user.confirmed_at
      assert redirected_to(conn) == ~p"/"
      assert is_nil(Phoenix.Flash.get(conn.assigns.flash, :info))
    end

    test "redirects to the login page if the code is invalid", %{conn: conn} do
      conn = get(conn, ~p"/confirm/invalid_code")
      assert redirected_to(conn) == ~p"/login/email"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Code is invalid or it has expired."
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
