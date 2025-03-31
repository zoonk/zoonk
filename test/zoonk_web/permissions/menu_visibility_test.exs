defmodule ZoonkWeb.MenuVisibilityTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  describe "Menu visibility" do
    test "non authenticated menu items", %{conn: conn} do
      org_fixture(%{kind: :app})

      conn
      |> visit(~p"/catalog")
      |> assert_has("a", text: "Catalog")
      |> assert_has("a", text: "Login")
      |> assert_has("a", text: "Sign Up")
      |> refute_has("a", text: "Summary")
      |> refute_has("a", text: "Goals")
      |> refute_has("a", text: "Library")
      |> refute_has("a", text: "Editor")
      |> refute_has("a", text: "Organization")
      |> refute_has("a", text: "Settings")
      |> refute_has("a", text: "Logout")
    end

    test "guest user menu items", %{conn: conn} do
      org = org_fixture(%{kind: :app})
      user = user_fixture(%{kind: :guest})
      org_member_fixture(%{org: org, user: user, role: :member})

      conn
      |> login_user(user)
      |> assert_has("a", text: "Catalog")
      |> refute_has("a", text: "Login")
      |> refute_has("a", text: "Sign Up")
      |> assert_has("a", text: "Summary")
      |> assert_has("a", text: "Goals")
      |> assert_has("a", text: "Library")
      |> refute_has("a", text: "Editor")
      |> refute_has("a", text: "Organization")
      |> refute_has("a", text: "Settings")
      |> refute_has("a", text: "Logout")
    end

    test "regular user menu items", %{conn: conn} do
      org = org_fixture(%{kind: :app})
      user = user_fixture(%{kind: :regular})
      org_member_fixture(%{org: org, user: user, role: :member})

      conn
      |> login_user(user)
      |> assert_has("a", text: "Catalog")
      |> refute_has("a", text: "Login")
      |> refute_has("a", text: "Sign Up")
      |> assert_has("a", text: "Summary")
      |> assert_has("a", text: "Goals")
      |> assert_has("a", text: "Library")
      |> refute_has("a", text: "Editor")
      |> refute_has("a", text: "Organization")
      |> assert_has("a", text: "Settings")
      |> assert_has("a", text: "Logout")
    end

    test "admin user menu items", %{conn: conn} do
      org = org_fixture(%{kind: :app})
      user = user_fixture()
      org_member_fixture(%{org: org, user: user, role: :admin})

      conn
      |> login_user(user)
      |> assert_has("a", text: "Catalog")
      |> refute_has("a", text: "Login")
      |> refute_has("a", text: "Sign Up")
      |> assert_has("a", text: "Summary")
      |> assert_has("a", text: "Goals")
      |> assert_has("a", text: "Library")
      |> assert_has("a", text: "Editor")
      |> assert_has("a", text: "Organization")
      |> assert_has("a", text: "Settings")
      |> assert_has("a", text: "Logout")
    end
  end
end
