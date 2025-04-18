defmodule ZoonkWeb.RequireOrgAdminPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/org", menu: "Overview"},
          %{link: "/org/teams", menu: "Teams"},
          %{link: "/org/members", menu: "Members"},
          %{link: "/org/settings", menu: "Settings"},
          %{link: "/editor", menu: "Dashboard"},
          %{link: "/editor/new", menu: "Create New"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias ZoonkWeb.PermissionError

  describe "Org Admin authorization" do
    test "redirects unauthenticated users to login", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(page.link)
      |> assert_path(redirect_path(kind, page.link))
    end

    test "allows access for users with admin role", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})
      user = user_fixture()
      org_member_fixture(%{user: user, org: org, role: :admin})

      conn
      |> Map.put(:host, org.custom_domain)
      |> login_user(user)
      |> visit(page.link)
      |> assert_has("li[aria-current='page']", text: page.menu)
    end

    test "raises error for users with member role", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})
      user = user_fixture()
      org_member_fixture(%{user: user, org: org, role: :member})

      assert_raise PermissionError, fn ->
        conn
        |> Map.put(:host, org.custom_domain)
        |> login_user(user)
        |> visit(page.link)
      end
    end
  end
end
