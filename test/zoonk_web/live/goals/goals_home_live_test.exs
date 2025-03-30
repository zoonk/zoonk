defmodule ZoonkWeb.Goals.GoalsHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "goals home page" do
    test "handle org authorization" do
      assert_page_authorization(%{link: ~p"/goals", title: "Goals"})
    end
  end
end
