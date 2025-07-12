defmodule ZoonkWeb.RequireOrgMemberPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/learn", menu: "Get Started"},
          %{link: "/my-courses", menu: "My courses"},
          %{link: "/missions", menu: "Missions"},
          %{link: "/purchases", menu: "Purchases"},
          %{link: "/subscription", menu: "Subscription"},
          %{link: "/language", menu: "App language"},
          %{link: "/name", menu: "Display name"},
          %{link: "/email", menu: "Change email"}
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
      |> assert_path("/login")
    end

    test "allows access for confirmed members", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})
      user = user_fixture()
      org_member_fixture(%{user: user, org: org, role: :member})

      conn
      |> Map.put(:host, org.custom_domain)
      |> login_user(user)
      |> visit(page.link)
      |> assert_path(page.link)
    end

    test "raises error for unconfirmed members", %{conn: conn, page: page, kind: kind} do
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

    test "raises error for non-members", %{conn: conn, page: page, kind: kind} do
      if kind != :app do
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

    test "allows access to app kind even if non-member", %{conn: conn, page: page, kind: kind} do
      if kind == :app do
        org = org_fixture(%{kind: :app})
        user = user_fixture()

        conn
        |> Map.put(:host, org.custom_domain)
        |> login_user(user)
        |> visit(page.link)
        |> assert_path(page.link)
      end
    end
  end
end
