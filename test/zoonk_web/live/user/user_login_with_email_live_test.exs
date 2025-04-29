defmodule ZoonkWeb.User.UserLoginWithEmailLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  describe "login with email page" do
    test "renders login with email page", %{conn: conn} do
      conn
      |> visit(~p"/login/email")
      |> assert_has("button[type=submit]", text: "Login")
    end
  end

  describe "user login - OTP code" do
    test "sends OTP code email when user exists", %{conn: conn} do
      user = user_fixture()

      conn
      |> visit(~p"/login/email")
      |> fill_in("Email address", with: user.email)
      |> submit()
      |> assert_has("p", text: "If your email is in our system")

      assert Zoonk.Repo.get_by!(Zoonk.Accounts.UserToken, user_id: user.id).context == "login"
    end

    test "does not disclose if user is signed up", %{conn: conn} do
      conn
      |> visit(~p"/login/email")
      |> fill_in("Email address", with: "idonotexist@example.com")
      |> submit()
      |> assert_has("p", text: "If your email is in our system")
    end

    test "displays the login form when the user clicks 'Try again'", %{conn: conn} do
      conn
      |> visit(~p"/login/email")
      |> fill_in("Email address", with: "user@example.com")
      |> submit()
      |> refute_has("form")
      |> click_button("Try again")
      |> assert_has("form")
    end
  end

  describe "login navigation" do
    test "redirects to signup page when the sign up button is clicked", %{conn: conn} do
      conn
      |> visit(~p"/login/email")
      |> click_link("Sign up")
      |> assert_path(~p"/signup")
      |> assert_has("a", text: "Sign up with Email")
    end
  end
end
