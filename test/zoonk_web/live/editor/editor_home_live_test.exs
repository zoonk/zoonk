defmodule ZoonkWeb.EditorHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "editor home page" do
    test "handle org authorization" do
      assert_admin_page_authorization(%{link: ~p"/editor", title: "Dashboard"})
    end
  end
end
