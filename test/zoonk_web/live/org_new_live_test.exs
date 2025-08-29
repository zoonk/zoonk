defmodule ZoonkWeb.OrgNewLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.OrgFixtures

  describe "/orgs/new (unauthenticated)" do
    test "redirects page for system org" do
      build_conn()
      |> Map.put(:host, system_org_fixture().custom_domain)
      |> visit(~p"/orgs/new")
      |> assert_path(~p"/login")
    end
  end

  describe "/orgs/new (authenticated for system org)" do
    setup :signup_and_login_user

    test "renders the page", %{conn: conn} do
      conn
      |> visit(~p"/orgs/new")
      |> assert_has("h1", text: "Create a new organization")
    end
  end

  describe "/orgs/new (authenticated for non-system org)" do
    setup :signup_and_login_user_for_public_external_org

    test "redirects to login page", %{conn: conn} do
      error =
        assert_raise ZoonkWeb.PermissionError, fn ->
          visit(conn, ~p"/orgs/new")
        end

      assert error.message =~ "You don't have permission to access this page"
    end
  end
end
