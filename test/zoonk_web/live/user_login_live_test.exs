defmodule ZoonkWeb.UserLoginLiveTest do
  @moduledoc false
  use ZoonkWeb.ConnCase

  import Phoenix.LiveViewTest
  import Zoonk.AccountsFixtures

  describe "Log in page" do
    test "renders log in page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/users/log_in")

      assert html =~ "Sign in"
      assert html =~ "Sign up"
      assert html =~ "Forgot your password?"
    end

    test "redirects if already logged in", %{conn: conn} do
      result =
        conn
        |> log_in_user(user_fixture())
        |> live(~p"/users/log_in")
        |> follow_redirect(conn, "/")

      assert {:ok, _conn} = result
    end

    test "use the browser's language as the default value", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "pt-BR")
      {:ok, _lv, html} = live(conn, ~p"/users/log_in")

      assert html =~ "Entrar na conta"
    end
  end

  describe "user login" do
    test "redirects if user login with valid credentials", %{conn: conn} do
      password = "ValidPassword1"
      user = user_fixture(%{password: password})

      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      form =
        form(lv, "#login_form",
          user: %{email_or_username: user.email, password: password, remember_me: true}
        )

      conn = submit_form(form, conn)

      assert redirected_to(conn) == ~p"/"
    end

    test "redirects to login page with a flash error if there are no valid credentials", %{
      conn: conn
    } do
      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      form =
        form(lv, "#login_form",
          user: %{email_or_username: "test@email.com", password: "123456", remember_me: true}
        )

      conn = submit_form(form, conn)

      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "Invalid email/username or password"

      assert redirected_to(conn) == "/users/log_in"
    end

    test "user authentication using username", %{conn: conn} do
      password = "ValidPassword1"
      user = user_fixture(%{password: password})

      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      form =
        form(lv, "#login_form",
          user: %{email_or_username: user.username, password: password, remember_me: true}
        )

      conn = submit_form(form, conn)

      assert redirected_to(conn) == ~p"/"
    end
  end

  describe "login navigation" do
    test "redirects to registration page when the Register button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      {:ok, _login_live, login_html} =
        lv
        |> element(~s|main a:fl-contains("Sign up")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/users/register")

      assert login_html =~ "Register"
    end

    test "redirects to forgot password page when the Forgot Password button is clicked", %{
      conn: conn
    } do
      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      {:ok, _login_live, login_html} =
        lv
        |> element(~s|main a:fl-contains("Forgot your password?")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/users/reset_password")

      assert login_html =~ "Forgot your password?"
    end
  end
end
