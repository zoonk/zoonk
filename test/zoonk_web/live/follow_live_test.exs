defmodule ZoonkWeb.FollowLiveTest do
  use ZoonkWeb.ConnCase, async: true

  describe "follow page" do
    setup :signup_and_login_user

    test "renders follow page with global links for non-pt locale", %{conn: conn} do
      conn
      |> visit(~p"/follow")
      |> assert_has("h1", text: "Follow us")
      |> assert_has("p", text: "r/zoonk")
      |> refute_has("p", text: "@zoonkbr")
    end

    test "renders follow page with Brazil links for pt locale", %{conn: conn, user: user} do
      # Update user language to Portuguese
      Zoonk.Accounts.update_user_settings(user, %{language: :pt})

      conn
      |> visit(~p"/follow")
      |> assert_has("h1", text: "Follow us")
      |> assert_has("p", text: "@zoonkbr")
      |> refute_has("p", text: "r/zoonk")
    end
  end

  describe "follow page for unauthenticated users" do
    test "renders follow page with global links for unauthenticated users", %{conn: conn} do
      org = Zoonk.OrgFixtures.org_fixture(%{kind: :app})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/follow")
      |> assert_has("h1", text: "Follow us")
      |> assert_has("p", text: "r/zoonk")
    end
  end
end
