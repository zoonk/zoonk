defmodule ZoonkWeb.AppHeaderTest do
  use ZoonkWeb.ConnCase,
    async: true,
    parameterize:
      for(
        kind <- [:app, :creator, :team, :school],
        page <- [
          %{link: "/", menu: "Summary"},
          %{link: "/catalog", menu: "Catalog"},
          %{link: "/goals", menu: "Goals"},
          %{link: "/library", menu: "Library"}
        ],
        do: %{kind: kind, page: page}
      )

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  describe "App header" do
    test "renders the header", %{conn: conn, kind: kind, page: page} do
      org = org_fixture(%{kind: kind})
      user = user_fixture(%{preload: [:profile]})
      org_member_fixture(%{org: org, user: user})

      conn
      |> login_user(user)
      |> visit(page.link)
      |> assert_has("h1", text: page.menu)
      |> assert_has("img[src='#{user.profile.picture_url}']")
      |> click_link("Go to settings")
      |> assert_path(~p"/user/email")
    end
  end
end
