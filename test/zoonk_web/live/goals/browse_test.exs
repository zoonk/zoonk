defmodule ZoonkWeb.GoalsLive.BrowseTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "browse goals page" do
    setup :register_and_signin_user

    test "renders page", %{conn: conn} do
      {:ok, home_lv, _html} = live(conn, ~p"/")

      {:ok, catalog_lv, _html} =
        home_lv
        |> element("a", "Goals")
        |> render_click()
        |> follow_redirect(conn, ~p"/goals")

      assert has_element?(catalog_lv, "h1", "Goals")
    end
  end
end
