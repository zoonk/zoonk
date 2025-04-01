defmodule ZoonkWeb.PublicPagesPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/catalog", menu: "Catalog"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.OrgFixtures

  describe "Public pages permissions" do
    test "allows unauthenticated users to access public pages from public orgs", %{conn: conn, page: page, kind: kind} do
      if kind in [:app, :creator] do
        org = org_fixture(%{kind: kind})

        conn
        |> Map.put(:host, org.custom_domain)
        |> visit(page.link)
        |> assert_has("li[aria-current='page']", text: page.menu)
      end
    end

    test "redirects unauthenticated users to login for private orgs", %{conn: conn, page: page, kind: kind} do
      if kind in [:team, :school] do
        org = org_fixture(%{kind: kind, public: false})

        conn
        |> Map.put(:host, org.custom_domain)
        |> visit(page.link)
        |> assert_path(~p"/login")
      end
    end
  end
end
