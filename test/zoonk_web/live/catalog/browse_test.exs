defmodule ZoonkWeb.CatalogLive.BrowseTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "browse catalog page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn = get(conn, ~p"/catalog")
      assert redirected_to(conn) == ~p"/login"
    end
  end

  describe "browse catalog page" do
    setup :register_and_signin_user

    test "renders page", %{conn: conn} do
      {:ok, home_lv, _html} = live(conn, ~p"/")

      {:ok, catalog_lv, _html} =
        home_lv
        |> element("a", "Catalog")
        |> render_click()
        |> follow_redirect(conn, ~p"/catalog")

      assert has_element?(catalog_lv, "h1", "Catalog")
      assert has_element?(catalog_lv, "li[aria-current='page']", "Catalog")
    end
  end
end
