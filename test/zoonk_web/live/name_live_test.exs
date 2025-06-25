defmodule ZoonkWeb.NameLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "update display name form" do
    setup :signup_and_login_user

    test "updates display name successfully", %{conn: conn, user: user} do
      new_name = "Updated Display Name"

      conn
      |> visit(~p"/name")
      |> fill_in("Display name", with: new_name)
      |> submit()
      |> assert_has("div", text: "Display name updated successfully.")

      # Verify the change was persisted
      updated_user = Zoonk.Repo.preload(user, :profile, force: true)
      assert updated_user.profile.display_name == new_name
    end

    test "renders errors with invalid data (phx-change)", %{conn: conn} do
      # Test with excessively long name
      long_name = String.duplicate("a", 101)
      
      conn
      |> visit(~p"/name")
      |> fill_in("Display name", with: long_name)
      |> assert_has("p", text: "should be at most 100 character(s)")
    end

    test "allows empty display name", %{conn: conn, user: user} do
      conn
      |> visit(~p"/name")
      |> fill_in("Display name", with: "")
      |> submit()
      |> assert_has("div", text: "Display name updated successfully.")

      # Verify the change was persisted
      updated_user = Zoonk.Repo.preload(user, :profile, force: true)
      assert updated_user.profile.display_name == nil
    end
  end
end