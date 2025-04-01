defmodule ZoonkWeb.PublicPagesPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator],
        page <- [
          %{link: "/catalog", menu: "Catalog"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.OrgFixtures

  describe "Public pages permissions" do
    test "allows unauthenticated users to access public pages", %{conn: conn, page: page, kind: kind} do
      org = org_fixture(%{kind: kind})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(page.link)
      |> assert_has("li[aria-current='page']", text: page.menu)
    end
  end
end
