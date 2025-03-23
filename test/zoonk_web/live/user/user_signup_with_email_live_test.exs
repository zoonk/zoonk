defmodule ZoonkWeb.User.SignUpWithEmailLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AccountFixtures

  describe "Sign up with email page" do
    test "renders signup page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")
      assert has_element?(lv, "button[type=submit]", "Create an account")
    end

    test "redirects if already logged in", %{conn: conn} do
      result =
        conn
        |> login_user(user_fixture())
        |> live(~p"/signup/email")
        |> follow_redirect(conn, ~p"/")

      assert {:ok, _conn} = result
    end

    test "renders errors for invalid data", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      result =
        lv
        |> element("#signup_form")
        |> render_change(user: %{"email" => "with spaces"})

      assert result =~ "Create an account"
      assert result =~ "must have the @ sign and no spaces"
    end
  end

  describe "signs up user" do
    test "use the browser's language", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "pt-BR")

      {:ok, lv, html} = live(conn, ~p"/signup/email")

      assert html =~ ~s'<html lang="pt"'
      assert has_element?(lv, "option[value=pt][selected]")
    end

    test "handles an unsupported locale", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "hi")

      assert {:ok, _lv, html} = live(conn, ~p"/signup/email")

      assert html =~ "Create an account"
      assert html =~ ~s'<html lang="en"'
    end

    test "creates account but does not log in", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      email = unique_user_email()
      form = form(lv, "#signup_form", user: valid_user_attributes(email: email))

      render_submit(form)

      assert has_element?(lv, "p", "An email was sent to #{email}")

      user = Zoonk.Accounts.get_user_by_email(email)
      assert user.confirmed_at == nil
    end

    test "renders errors for duplicated email", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      user = user_fixture(%{email: "test@email.com"})

      result =
        lv
        |> form("#signup_form",
          user: %{"email" => user.email}
        )
        |> render_submit()

      assert result =~ "has already been taken"
    end
  end

  describe "signup navigation" do
    test "redirects to login page when the Log in button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      {:ok, _login_live, login_html} =
        lv
        |> element(~s|a:fl-contains("Login")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/login")

      assert login_html =~ "login"
    end
  end
end
