defmodule ZoonkWeb.Org.OrgSettingsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "org settings page" do
    test "handle org authorization" do
      assert_admin_page_authorization(%{link: ~p"/org/settings", title: "Settings"})
    end
  end
end
