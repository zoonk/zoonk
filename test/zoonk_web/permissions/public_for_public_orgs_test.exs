defmodule ZoonkWeb.PublicForPublicOrgsPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:system, :external],
        page <- [
          %{link: "/catalog"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.OrgFixtures

  describe "Public pages permissions" do
    test "allows unauthenticated users to access public pages from public orgs", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind, is_public: true})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(page.link)
      |> assert_path(page.link)
      |> assert_has("a", text: "Login")
    end

    test "redirects unauthenticated users to login for private orgs", %{conn: conn, page: page, kind: kind} do
      if kind == :external do
        org = org_fixture(%{kind: kind, is_public: false})

        conn
        |> Map.put(:host, org.custom_domain)
        |> visit(page.link)
        |> assert_path(~p"/login")
      end
    end
  end
end
