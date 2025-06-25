defmodule ZoonkWeb.NameLiveTest do
  use ZoonkWeb.ConnCase, async: true

  alias Zoonk.Accounts
  alias Zoonk.Accounts.UserProfile
  alias Zoonk.Repo

  describe "update display name form" do
    setup :signup_and_login_user

    test "updates display name successfully", %{conn: conn, user: user} do
      new_display_name = "John Doe"

      conn
      |> visit(~p"/name")
      |> fill_in("Name", with: new_display_name)
      |> refute_has("p", text: "Done!")
      |> submit()
      |> assert_path(~p"/name")
      |> assert_has("p", text: "Done!")

      # Verify the display name was actually updated in the database
      updated_profile = Repo.get_by!(UserProfile, user_id: user.id)
      assert updated_profile.display_name == new_display_name
    end

    test "allows users to clear their display name", %{conn: conn, user: user} do
      # First set a display name
      profile = Repo.get_by!(UserProfile, user_id: user.id)
      {:ok, _updated_profile} = Accounts.update_user_profile(profile, %{display_name: "Initial Name"})

      conn
      |> visit(~p"/name")
      |> fill_in("Name", with: "")
      |> refute_has("p", text: "Done!")
      |> submit()
      |> assert_path(~p"/name")
      |> assert_has("p", text: "Done!")

      # Verify the display name was cleared
      updated_profile = Repo.get_by!(UserProfile, user_id: user.id)
      assert is_nil(updated_profile.display_name)
    end

    test "renders errors with invalid data (phx-change)", %{conn: conn} do
      # 33 characters, exceeding the 32 limit
      long_name = String.duplicate("a", 33)

      conn
      |> visit(~p"/name")
      |> fill_in("Name", with: long_name)
      |> assert_has("p", text: "should be at most 32 character(s)")
    end

    test "renders errors with invalid data (phx-submit)", %{conn: conn} do
      # 33 characters, exceeding the 32 limit
      long_name = String.duplicate("a", 33)

      conn
      |> visit(~p"/name")
      |> fill_in("Name", with: long_name)
      |> submit()
      |> assert_has("p", text: "should be at most 32 character(s)")
      |> refute_has("p", text: "Done!")
    end

    test "displays current display name in the form", %{conn: conn, user: user} do
      current_name = "Current Display Name"
      profile = Repo.get_by!(UserProfile, user_id: user.id)
      {:ok, _updated_profile} = Accounts.update_user_profile(profile, %{display_name: current_name})

      conn
      |> visit(~p"/name")
      |> assert_has("input[value='#{current_name}']")
    end

    test "displays empty field when user has no display name", %{conn: conn} do
      conn
      |> visit(~p"/name")
      |> assert_has("input[id='user-display-name']")
      |> refute_has("input[value]:not([value=''])")
    end
  end
end
