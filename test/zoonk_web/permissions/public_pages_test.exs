defmodule ZoonkWeb.PublicPagesPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator],
        page <- [
          %{link: "/start", title: "Get Started"},
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
      |> assert_page(page)
    end
  end

  defp assert_page(session, %{menu: menu}) do
    assert_has(session, "li[aria-current='page']", text: menu)
  end

  defp assert_page(session, %{title: title}) do
    assert_has(session, "h1", text: title)
  end
end
