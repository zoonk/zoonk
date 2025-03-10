defmodule ZoonkWeb.GoalsLive.BrowseTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "browse goals page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn = get(conn, ~p"/goals")
      assert redirected_to(conn) == ~p"/login"
    end
  end

  describe "browse goals page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      {:ok, home_lv, _html} = live(conn, ~p"/")

      {:ok, catalog_lv, _html} =
        home_lv
        |> element("a", "Goals")
        |> render_click()
        |> follow_redirect(conn, ~p"/goals")

      assert has_element?(catalog_lv, "h1", "Goals")
      assert has_element?(catalog_lv, "li[aria-current='page']", "Goals")
    end
  end
end
