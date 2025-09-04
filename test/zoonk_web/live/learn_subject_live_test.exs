defmodule ZoonkWeb.LearnSubjectLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.CatalogFixtures
  import Zoonk.OrgFixtures

  @page_title "What do you want to learn?"

  describe "learn subject (unauthenticated)" do
    test "redirects page for system org" do
      build_conn()
      |> Map.put(:host, system_org_fixture().custom_domain)
      |> visit(~p"/learn")
      |> assert_path(~p"/login")
    end

    test "redirects page for :external org" do
      org = org_fixture(%{kind: :external, is_public: false})

      build_conn()
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/learn")
      |> assert_path(~p"/login")
    end
  end

  describe "learn subject (authenticated to system org)" do
    setup :signup_and_login_user

    test "allows authenticated user to see the page", %{conn: conn} do
      %{suggestions: suggestions} = course_suggestion_fixture()
      suggestion = hd(suggestions)

      conn
      |> visit(~p"/learn")
      |> assert_path(~p"/learn")
      |> assert_has("h1", text: @page_title)
      |> assert_has(".zk-btn-active", text: "Start course")
      |> refute_has("select")
      |> fill_in("#learn-subject input", "What do you want to learn?", with: "programming")
      |> submit()
      |> assert_path(~p"/learn/programming")
      |> assert_has("h3", text: suggestion.title, timeout: 1)
    end
  end

  describe "learn subject (authenticated to public external org)" do
    setup :signup_and_login_user_for_public_external_org

    test "doesn't allow access for public external org", %{conn: conn} do
      error =
        assert_raise ZoonkWeb.PermissionError, fn ->
          visit(conn, ~p"/learn")
        end

      assert error.message == "Your organization doesn't have access to this feature."
    end
  end
end
