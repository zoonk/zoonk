defmodule ZoonkWeb.HomeAdminLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "home admin (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      assert {:ok, _conn} =
               conn
               |> live(~p"/admin")
               |> follow_redirect(conn, ~p"/login")
    end
  end

  describe "home admin (non admin)" do
    setup :signup_and_login_user

    test "redirects to the home page", %{conn: conn} do
      assert {:ok, _conn} =
               conn
               |> live(~p"/admin")
               |> follow_redirect(conn, ~p"/")
    end
  end
end
