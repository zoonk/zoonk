defmodule ZoonkWeb.UserLive.SignUpTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AccountFixtures

  describe "Signup page" do
    test "renders signup page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/signup")
      assert html =~ "Sign up"
    end

    test "redirects if already logged in", %{conn: conn} do
      result =
        conn
        |> login_user(user_fixture())
        |> live(~p"/signup")
        |> follow_redirect(conn, ~p"/")

      assert {:ok, _conn} = result
    end
  end

  describe "signup navigation" do
    test "redirects to login page when the Log in button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      {:ok, login_live, _login_html} =
        lv
        |> element(~s|a:fl-contains("Login")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/login")

      assert has_element?(login_live, "a", "Login with Email")
    end

    test "redirects to the sign up with email page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup")

      {:ok, signup_live, _signup_html} =
        lv
        |> element(~s|a:fl-contains("Sign up with Email")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/signup/email")

      assert has_element?(signup_live, "button", "Create an account")
    end
  end
end
