defmodule ZoonkWeb.Library.LibraryHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "library home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn = get(conn, ~p"/library")
      assert redirected_to(conn) == ~p"/login"
    end
  end

  describe "library home page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      {:ok, home_lv, _html} = live(conn, ~p"/")

      {:ok, catalog_lv, _html} =
        home_lv
        |> element("a", "Library")
        |> render_click()
        |> follow_redirect(conn, ~p"/library")

      assert has_element?(catalog_lv, "li[aria-current='page']", "Library")
    end
  end
end
