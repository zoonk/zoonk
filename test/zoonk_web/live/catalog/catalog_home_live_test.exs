defmodule ZoonkWeb.Catalog.CatalogHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import ZoonkWeb.OrgMemberRequiredHelper

  describe "catalog home page" do
    test "handle org authorization" do
      assert_page_authorization(%{link: ~p"/catalog", title: "Catalog"})
    end
  end
end
