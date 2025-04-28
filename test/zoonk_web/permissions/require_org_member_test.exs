defmodule ZoonkWeb.RequireOrgMemberPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/", menu: "Summary"},
          %{link: "/settings", menu: "Settings"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias ZoonkWeb.PermissionError

  describe "Org Member authorization" do
    test "redirects unauthenticated users to login", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(page.link)
      |> assert_path(redirect_path(kind, page.link))
    end

    test "allows access without membership for public organizations", %{conn: conn, page: page, kind: kind} do
      if kind in [:app, :creator] do
        org = org_fixture(%{kind: kind})
        user = user_fixture()

        conn
        |> Map.put(:host, org.custom_domain)
        |> login_user(user)
        |> visit(page.link)
        |> assert_path(page.link)
      end
    end

    test "allows access for unconfirmed users in public organizations", %{conn: conn, page: page, kind: kind} do
      if kind in [:app, :creator] do
        org = org_fixture(%{kind: kind})
        user = unconfirmed_user_fixture()
        org_member_fixture(%{user: user, org: org, role: :member})

        conn
        |> Map.put(:host, org.custom_domain)
        |> login_user(user)
        |> visit(page.link)
        |> assert_path(page.link)
      end
    end

    test "allows access for confirmed members in private organizations", %{conn: conn, page: page, kind: kind} do
      if kind in [:team, :school] do
        org = org_fixture(%{kind: kind})
        user = user_fixture()
        org_member_fixture(%{user: user, org: org, role: :member})

        conn
        |> Map.put(:host, org.custom_domain)
        |> login_user(user)
        |> visit(page.link)
        |> assert_path(page.link)
      end
    end

    test "raises error for unconfirmed members in private organizations", %{conn: conn, page: page, kind: kind} do
      if kind in [:team, :school] do
        org = org_fixture(%{kind: kind})
        user = unconfirmed_user_fixture()
        org_member_fixture(%{user: user, org: org, role: :member})

        assert_raise PermissionError, fn ->
          conn
          |> Map.put(:host, org.custom_domain)
          |> login_user(user)
          |> visit(page.link)
        end
      end
    end

    test "raises error for non-members in private organizations", %{conn: conn, page: page, kind: kind} do
      if kind in [:team, :school] do
        org = org_fixture(%{kind: kind})
        user = user_fixture()

        assert_raise PermissionError, fn ->
          conn
          |> Map.put(:host, org.custom_domain)
          |> login_user(user)
          |> visit(page.link)
        end
      end
    end
  end
end
