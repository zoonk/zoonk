defmodule ZoonkWeb.User.UserSignUpLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  describe "Signup page" do
    setup :setup_app

    test "renders signup page", %{conn: conn} do
      conn
      |> visit(~p"/signup")
      |> assert_has("h1", text: "Start learning")
    end

    test "redirects if already logged in", %{conn: conn} do
      conn
      |> login_user(user_fixture())
      |> visit(~p"/signup")
      |> assert_path(~p"/")
    end
  end

  describe "signup navigation" do
    setup :setup_app

    test "redirects to login page when the Log in button is clicked", %{conn: conn} do
      conn
      |> visit(~p"/signup/email")
      |> click_link("Login")
      |> assert_path(~p"/login")
      |> assert_has("a", text: "Login with Email")
    end

    test "redirects to the sign up with email page", %{conn: conn} do
      conn
      |> visit(~p"/signup")
      |> click_link("Sign up with Email")
      |> assert_path(~p"/signup/email")
      |> assert_has("button", text: "Create an account")
    end
  end
end
