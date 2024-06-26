defmodule ZoonkWeb.UserSessionControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.Fixtures.Accounts

  setup do
    %{user: user_fixture()}
  end

  describe "POST /users/login" do
    setup :set_school

    test "logs the user in", %{conn: conn, user: user} do
      conn = post(conn, ~p"/users/login", %{"user" => %{"email" => user.email, "password" => valid_user_password()}})

      assert get_session(conn, :user_token)
      assert redirected_to(conn) == ~p"/"

      # Now do a logged in request and assert on the menu
      response = html_response(get(conn, ~p"/courses"), 200)
      assert response =~ "Settings"
    end

    test "logs the user in with remember me", %{conn: conn, user: user} do
      conn = post(conn, ~p"/users/login", %{"user" => %{"email" => user.email, "password" => valid_user_password(), "remember_me" => "true"}})

      assert conn.resp_cookies["_zoonk_web_user_remember_me"]
      assert redirected_to(conn) == ~p"/"
    end

    test "logs the user in with return to", %{conn: conn, user: user} do
      conn =
        conn
        |> init_test_session(user_return_to: "/foo/bar")
        |> post(~p"/users/login", %{"user" => %{"email" => user.email, "password" => valid_user_password()}})

      assert redirected_to(conn) == "/foo/bar"
    end

    test "login following registration", %{conn: conn, user: user} do
      conn = post(conn, ~p"/users/login", %{"_action" => "registered", "user" => %{"email" => user.email, "password" => valid_user_password()}})
      assert redirected_to(conn) == ~p"/"
    end

    test "login following password update", %{conn: conn, user: user} do
      conn = post(conn, ~p"/users/login", %{"_action" => "password_updated", "user" => %{"email" => user.email, "password" => valid_user_password()}})

      assert redirected_to(conn) == ~p"/users/settings/password"
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Password updated successfully"
    end

    test "redirects to login page with invalid credentials", %{conn: conn} do
      conn = post(conn, ~p"/users/login", %{"user" => %{"email" => "invalid@email.com", "password" => "invalid_password"}})

      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "Invalid email or password."
      assert redirected_to(conn) == ~p"/users/login"
    end
  end

  describe "DELETE /users/logout" do
    test "logs the user out", %{conn: conn, user: user} do
      conn = conn |> log_in_user(user) |> delete(~p"/users/logout")
      assert redirected_to(conn) == ~p"/users/login"
      refute get_session(conn, :user_token)
    end

    test "succeeds even if the user is not logged in", %{conn: conn} do
      conn = delete(conn, ~p"/users/logout")
      assert redirected_to(conn) == ~p"/users/login"
      refute get_session(conn, :user_token)
    end
  end
end
