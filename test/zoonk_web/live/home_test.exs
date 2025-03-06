defmodule ZoonkWeb.HomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "home page" do
    setup :register_and_signin_user

    test "renders page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/")

      assert has_element?(lv, "h1", "Summary")
      assert has_element?(lv, "li[aria-current='page']", "Summary")
    end
  end
end
