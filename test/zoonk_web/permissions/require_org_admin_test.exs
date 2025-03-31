defmodule ZoonkWeb.RequireOrgAdminPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/org"},
          %{link: "/org/teams"},
          %{link: "/org/members"},
          %{link: "/org/settings"},
          %{link: "/editor"},
          %{link: "/editor/new"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.OrgFixtures

  describe "Org Admin authorization" do
    test "redirects unauthenticated users to login", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(page.link)
      |> assert_path(~p"/login")
    end
  end
end
