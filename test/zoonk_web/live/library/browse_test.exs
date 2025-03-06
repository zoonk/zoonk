defmodule ZoonkWeb.LibraryLive.BrowseTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "browse library page" do
    setup :register_and_signin_user

    test "renders page", %{conn: conn} do
      {:ok, home_lv, _html} = live(conn, ~p"/")

      {:ok, catalog_lv, _html} =
        home_lv
        |> element("a", "Library")
        |> render_click()
        |> follow_redirect(conn, ~p"/library")

      assert has_element?(catalog_lv, "h1", "Library")
      assert has_element?(catalog_lv, "li[aria-current='page']", "Library")
    end
  end
end
