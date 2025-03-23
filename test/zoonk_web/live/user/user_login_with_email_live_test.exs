defmodule ZoonkWeb.User.UserLoginWithEmailLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AccountFixtures

  describe "login with email page" do
    test "renders login with email page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login/email")
      assert has_element?(lv, "button[type=submit]", "Login")
    end
  end

  describe "user login - magic link" do
    test "sends magic link email when user exists", %{conn: conn} do
      user = user_fixture()

      {:ok, lv, _html} = live(conn, ~p"/login/email")

      lv
      |> form("#login_form_magic", %{email: user.email})
      |> render_submit()

      assert has_element?(lv, "p", "If your email is in our system")
      assert Zoonk.Repo.get_by!(Zoonk.Accounts.UserToken, user_id: user.id).context == "login"
    end

    test "does not disclose if user is signed up", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login/email")

      lv
      |> form("#login_form_magic", %{email: "idonotexist@example.com"})
      |> render_submit()

      assert has_element?(lv, "p", "If your email is in our system")
    end

    test "displays the login form when the user clicks 'Try again'", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login/email")

      lv
      |> form("#login_form_magic", %{email: "user@example.com"})
      |> render_submit()

      refute has_element?(lv, "form")

      lv
      |> element("button", "Try again")
      |> render_click()

      assert has_element?(lv, "form")
    end
  end

  describe "login navigation" do
    test "redirects to signup page when the sign up button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/login/email")

      {:ok, _login_live, login_html} =
        lv
        |> element(~s|a:fl-contains("Sign up")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/signup")

      assert login_html =~ "Sign up"
    end
  end
end
