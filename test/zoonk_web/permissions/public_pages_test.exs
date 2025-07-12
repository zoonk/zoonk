defmodule ZoonkWeb.PublicPagesPermissionTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        page <- [
          %{link: "/signup"},
          %{link: "/signup/email"},
          %{link: "/login"},
          %{link: "/login/email"},
          %{link: "/confirm/login"},
          %{link: "/confirm/signup"},
          %{link: "/confirm/email"},
          %{link: "/terms"},
          %{link: "/privacy"},
          %{link: "/feedback"},
          %{link: "/support"},
          %{link: "/follow"}
        ],
        do: %{page: page}
      )

  import Zoonk.OrgFixtures

  describe "Public pages permissions" do
    test "allows unauthenticated users to access public pages", %{conn: conn, page: page} do
      org = org_fixture()

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(page.link)
      |> assert_path(page.link)
    end
  end
end
