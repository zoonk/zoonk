defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "app home page" do
    test "handle org authorization" do
      assert_page_authorization(%{link: ~p"/", title: "Summary"})
    end
  end
end
