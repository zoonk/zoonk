defmodule ZoonkWeb.MenuVisibilityTest do
  use ZoonkWeb.ConnCase, async: true

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
  end
end
