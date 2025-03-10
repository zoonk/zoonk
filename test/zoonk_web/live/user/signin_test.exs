defmodule ZoonkWeb.UserLive.SignTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "login page" do
    test "renders login page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/login")
      assert html =~ "Login with Email"
    end
  end

  describe "login navigation" do
    test "redirects to the signup page when the sign up button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login")

      {:ok, login_live, _login_html} =
        lv
        |> element(~s|a:fl-contains("Sign up")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/signup")

      assert has_element?(login_live, "a", "Sign up with Email")
    end

    test "redirects to the login with email page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login")

      {:ok, login_live, _login_html} =
        lv
        |> element(~s|a:fl-contains("Login with Email")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/login/email")

      assert has_element?(login_live, "button", "Login")
    end
  end
end
