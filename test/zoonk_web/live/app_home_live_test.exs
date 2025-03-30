defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "app home page" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end

    test "handle org authorization" do
      assert_require_org_member(%{link: ~p"/", title: "Summary"})
    end
  end
end
