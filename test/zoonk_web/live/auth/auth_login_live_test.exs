defmodule ZoonkWeb.Auth.AuthLoginLiveTest do
  use ZoonkWeb.ConnCase, async: true

  setup :setup_app

  describe "login page" do
    test "renders login page", %{conn: conn} do
      conn
      |> visit(~p"/login")
      |> assert_has("a", text: "Login with Email")
    end
  end

  describe "login navigation" do
    test "redirects to the signup page when the sign up button is clicked", %{conn: conn} do
      conn
      |> visit(~p"/login")
      |> click_link("Sign up")
      |> assert_path(~p"/signup")
      |> assert_has("a", text: "Sign up with Email")
    end

    test "redirects to the login with email page", %{conn: conn} do
      conn
      |> visit(~p"/login")
      |> click_link("Login with Email")
      |> assert_path(~p"/login/email")
      |> assert_has("button", text: "Login")
    end
  end
end
