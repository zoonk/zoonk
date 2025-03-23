defmodule ZoonkWeb.Admin.AdminHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  describe "admin home (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      assert {:ok, _conn} =
               conn
               |> live(~p"/admin")
               |> follow_redirect(conn, ~p"/login")
    end
  end

  describe "admin home (non admin)" do
    setup :signup_and_login_user

    test "redirects to the home page", %{conn: conn} do
      assert {:ok, _conn} =
               conn
               |> live(~p"/admin")
               |> follow_redirect(conn, ~p"/")
    end
  end
end
