defmodule ZoonkWeb.Org.OrgHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "org home page" do
    test "handle org authorization" do
      assert_admin_page_authorization(%{link: ~p"/org", title: "Overview"})
    end
  end
end
