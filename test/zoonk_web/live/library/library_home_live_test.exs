defmodule ZoonkWeb.Library.LibraryHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  describe "library home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/library")
      |> assert_path(~p"/login")
    end
  end

  describe "library home page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> click_link("aside a", "Library")
      |> assert_path(~p"/library")
      |> assert_has("li[aria-current='page']", text: "Library")
    end
  end
end
