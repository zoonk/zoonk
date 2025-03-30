defmodule ZoonkWeb.Library.LibraryHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "library home page" do
    test "handle org authorization" do
      assert_page_authorization(%{link: ~p"/library", title: "Library"})
    end
  end
end
