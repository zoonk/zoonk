defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "app home page" do
    test "handle org authorization" do
      assert_require_org_member(%{link: ~p"/", title: "Summary"})
    end
  end
end
