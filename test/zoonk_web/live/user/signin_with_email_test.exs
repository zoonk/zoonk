defmodule ZoonkWeb.UserLive.SignInWithEmailTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AuthFixtures

  describe "signin with email page" do
    test "renders signin with email page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/login/email")
      assert html =~ "Log in with email"
    end
  end

  describe "user signin - magic link" do
    test "sends magic link email when user exists", %{conn: conn} do
      user = user_fixture()

      {:ok, lv, _html} = live(conn, ~p"/login/email")

      {:ok, _lv, html} =
        lv
        |> form("#signin_form_magic", %{email: user.email})
        |> render_submit()
        |> follow_redirect(conn, ~p"/login/email")

      assert html =~ "If your email is in our system"

      assert Zoonk.Repo.get_by!(Zoonk.Schemas.UserToken, user_id: user.id).context ==
               "signin"
    end

    test "does not disclose if user is registered", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login/email")

      {:ok, _lv, html} =
        lv
        |> form("#signin_form_magic", %{email: "idonotexist@example.com"})
        |> render_submit()
        |> follow_redirect(conn, ~p"/login/email")

      assert html =~ "If your email is in our system"
    end
  end

  describe "signin navigation" do
    test "redirects to registration page when the Register button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login/email")

      {:ok, _signin_live, signin_html} =
        lv
        |> element(~s|a:fl-contains("Sign up")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/signup")

      assert signin_html =~ "sign up"
    end
  end

  describe "re-authentication (sudo mode)" do
    setup %{conn: conn} do
      user = user_fixture()
      %{user: user, conn: signin_user(conn, user)}
    end

    test "shows signin page with email filled in", %{conn: conn, user: user} do
      {:ok, _lv, html} = live(conn, ~p"/login/email")

      assert html =~ "You need to reauthenticate"
      refute html =~ "Sign Up"
      assert html =~ "Log in with email"

      assert html =~
               ~s(<input type="email" name="email" id="signin_form_magic_email" value="#{user.email}")
    end
  end
end
