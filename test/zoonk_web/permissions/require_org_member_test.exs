defmodule ZoonkWeb.RequireOrgMemberPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/"},
          %{link: "/goals"},
          %{link: "/catalog"},
          %{link: "/library"},
          %{link: "/user/email"},
          %{link: "/user/billing"},
          %{link: "/user/interests"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.OrgFixtures

  describe "Org Member authorization" do
    test "redirects unauthenticated users to login", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(page.link)
      |> assert_path(~p"/login")
    end
  end
end
