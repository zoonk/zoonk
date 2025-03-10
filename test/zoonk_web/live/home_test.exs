defmodule ZoonkWeb.HomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn = get(conn, ~p"/")
      assert redirected_to(conn) == ~p"/login"
    end
  end

  describe "home page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/")

      assert has_element?(lv, "h1", "Summary")
      assert has_element?(lv, "li[aria-current='page']", "Summary")
    end

    test "navigates to the settings page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/")

      # Check if the avatar is rendered correctly without an image
      assert has_element?(lv, "a span", "u")

      assert {:ok, _redirect_lv, _html} =
               lv
               |> element("a[href='/user/email']")
               |> render_click()
               |> follow_redirect(conn, ~p"/user/email")
    end
  end
end
