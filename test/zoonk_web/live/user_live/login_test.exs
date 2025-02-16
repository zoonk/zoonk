defmodule ZoonkWeb.UserLive.LoginTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AuthFixtures

  describe "login page" do
    test "renders login page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/users/signin")

      assert html =~ "Log in"
      assert html =~ "Register"
      assert html =~ "Log in with email"
    end
  end

  describe "user login - magic link" do
    test "sends magic link email when user exists", %{conn: conn} do
      user = user_fixture()

      {:ok, lv, _html} = live(conn, ~p"/users/signin")

      {:ok, _lv, html} =
        lv
        |> form("#login_form_magic", %{email: user.email})
        |> render_submit()
        |> follow_redirect(conn, ~p"/users/signin")

      assert html =~ "If your email is in our system"

      assert Zoonk.Repo.get_by!(Zoonk.Auth.UserToken, user_id: user.id).context ==
               "login"
    end

    test "does not disclose if user is registered", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/signin")

      {:ok, _lv, html} =
        lv
        |> form("#login_form_magic", %{email: "idonotexist@example.com"})
        |> render_submit()
        |> follow_redirect(conn, ~p"/users/signin")

      assert html =~ "If your email is in our system"
    end
  end

  describe "login navigation" do
    test "redirects to registration page when the Register button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/signin")

      {:ok, _login_live, login_html} =
        lv
        |> element(~s|main a:fl-contains("Sign up")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/users/register")

      assert login_html =~ "Register"
    end
  end

  describe "re-authentication (sudo mode)" do
    setup %{conn: conn} do
      user = user_fixture()
      %{user: user, conn: log_in_user(conn, user)}
    end

    test "shows login page with email filled in", %{conn: conn, user: user} do
      {:ok, _lv, html} = live(conn, ~p"/users/signin")

      assert html =~ "You need to reauthenticate"
      refute html =~ "Register"
      assert html =~ "Log in with email"

      assert html =~
               ~s(<input type="email" name="email" id="login_form_magic_email" value="#{user.email}")
    end
  end
end
