defmodule ZoonkWeb.UserLive.SignUpTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AuthFixtures

  describe "Registration page" do
    test "renders registration page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/signup")
      assert html =~ "Sign up"
    end

    test "redirects if already logged in", %{conn: conn} do
      result =
        conn
        |> signin_user(user_fixture())
        |> live(~p"/signup")
        |> follow_redirect(conn, ~p"/")

      assert {:ok, _conn} = result
    end
  end

  describe "registration navigation" do
    test "redirects to signin page when the Log in button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      {:ok, signin_live, _signin_html} =
        lv
        |> element(~s|a:fl-contains("Login")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/login")

      assert has_element?(signin_live, "a", "Login with Email")
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
