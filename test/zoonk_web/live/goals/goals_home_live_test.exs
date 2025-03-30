defmodule ZoonkWeb.Goals.GoalsHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "goals home page" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/goals")
      |> assert_path(~p"/login")
    end

    test "handle org authorization" do
      assert_require_org_member(%{link: ~p"/goals", title: "Goals"})
    end
  end
end
