defmodule ZoonkWeb.FollowLiveTest do
  use ZoonkWeb.ConnCase, async: true

  alias Zoonk.Accounts

  describe "Follow page" do
    setup :setup_app

    test "displays global social media links for non-Portuguese users", %{conn: conn} do
      conn
      |> visit(~p"/follow")
      |> assert_has("a[href*='zoonkcom']")
      |> assert_has("a[href*='r/zoonk']")
      |> refute_has("a[href*='zoonkbr']")
      |> refute_has("a[href*='r/ZoonkBrasil']")
    end

    test "displays Brazil social media links for Portuguese users", %{conn: conn} do
      # Setup authenticated user with Portuguese language
      user = Zoonk.AccountFixtures.user_fixture()
      Accounts.update_user_settings(user, %{language: :pt})
      
      conn
      |> login_user(user)
      |> visit(~p"/follow")
      |> assert_has("a[href*='zoonkbr']")
      |> assert_has("a[href*='r/ZoonkBrasil']")
      |> refute_has("a[href*='zoonkcom']")
      |> refute_has("a[href*='r/zoonk']")
    end

    test "renders follow us page title", %{conn: conn} do
      conn
      |> visit(~p"/follow")
      |> assert_has("title", text: "Follow us")
    end
  end
end