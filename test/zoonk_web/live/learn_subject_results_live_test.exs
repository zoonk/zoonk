defmodule ZoonkWeb.LearnSubjectResultsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.CatalogFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Catalog

  describe "learn subject: results (unauthenticated)" do
    test "redirects page for system org" do
      build_conn()
      |> Map.put(:host, system_org_fixture().custom_domain)
      |> visit(~p"/learn/coding")
      |> assert_path(~p"/login")
    end

    test "redirects page for external org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :external}).custom_domain)
      |> visit(~p"/learn")
      |> assert_path(~p"/login")
    end
  end

  describe "learn subject: results  (authenticated to system org)" do
    setup :signup_and_login_user

    test "loads the data", %{conn: conn} do
      %{suggestions: suggestions} = course_suggestion_fixture()
      suggestion = hd(suggestions)

      conn
      |> visit(~p"/learn/coding")
      |> assert_path(~p"/learn/coding")
      |> assert_has("h3", text: suggestion.title, timeout: 1)
    end

    test "both thumbs up and down are not selected by default", %{conn: conn} do
      course_suggestion_fixture()

      conn
      |> visit(~p"/learn/coding")
      |> assert_has(".tabler-thumb-up", timeout: 1)
      |> assert_has(".tabler-thumb-down")
    end

    test "reacts to content with thumbs up", %{conn: conn, scope: scope} do
      course_suggestion = course_suggestion_fixture(%{scope: scope, query: "coding"})

      conn
      |> visit(~p"/learn/coding")
      |> refute_has(".tabler-thumb-up-filled", timeout: 1)
      |> click_button("Thumbs up")
      |> assert_has(".tabler-thumb-up-filled")

      assert Catalog.get_content_reaction(scope, course_suggestion.content_id).reaction == :thumbs_up
    end

    test "reacts to content with thumbs down", %{conn: conn, scope: scope} do
      course_suggestion = course_suggestion_fixture(%{scope: scope, query: "coding"})

      conn
      |> visit(~p"/learn/coding")
      |> refute_has(".tabler-thumb-down-filled", timeout: 1)
      |> click_button("Thumbs down")
      |> assert_has(".tabler-thumb-down-filled")

      assert Catalog.get_content_reaction(scope, course_suggestion.content_id).reaction == :thumbs_down
    end
  end

  describe "learn subject: results  (authenticated to public external org)" do
    setup :signup_and_login_user_for_public_external_org

    test "doesn't allow access for public external org", %{conn: conn} do
      error =
        assert_raise ZoonkWeb.PermissionError, fn ->
          visit(conn, ~p"/learn/coding")
        end

      assert error.message == "Your organization doesn't have access to this feature."
    end
  end
end
