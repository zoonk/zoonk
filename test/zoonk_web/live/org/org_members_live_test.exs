defmodule ZoonkWeb.Org.OrgMembersLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "org members page" do
    test "handle org authorization" do
      assert_admin_page_authorization(%{link: ~p"/org/members", title: "Members"})
    end
  end
end
