defmodule ZoonkWeb.Editor.EditorNewLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "editor new page" do
    test "handle org authorization" do
      assert_admin_page_authorization(%{link: ~p"/editor/new", title: "Create New"})
    end
  end
end
