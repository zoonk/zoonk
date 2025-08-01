defmodule ZoonkWeb.PublicForPublicOrgsPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/catalog"}
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
        |> assert_path(page.link)
      end
    end

    test "display login button on header", %{conn: conn, page: page, kind: kind} do
      if kind in [:app, :creator] do
        org = org_fixture(%{kind: kind})

        conn
        |> Map.put(:host, org.custom_domain)
        |> visit(page.link)
        |> assert_has("a", text: "Login")
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
