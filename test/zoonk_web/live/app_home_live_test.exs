defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  describe "app home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end
  end

  describe "app home page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end

    test "navigates to the settings page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> click_link("Email")
      |> assert_path(~p"/user/email")
    end
  end
end
