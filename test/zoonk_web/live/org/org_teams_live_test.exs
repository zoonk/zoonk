defmodule ZoonkWeb.Org.OrgTeamsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "org teams page" do
    test "handle org authorization" do
      assert_admin_page_authorization(%{link: ~p"/org/teams", title: "Teams"})
    end
  end
end
