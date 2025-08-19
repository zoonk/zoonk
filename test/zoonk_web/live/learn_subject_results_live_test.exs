defmodule ZoonkWeb.LearnSubjectResultsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.CatalogFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.AI
  alias Zoonk.Catalog

  describe "learn subject: results (unauthenticated)" do
    test "redirects page for :app org" do
      build_conn()
      |> Map.put(:host, app_org_fixture().custom_domain)
      |> visit(~p"/learn/coding")
      |> assert_path(~p"/login")
    end

    test "redirects page for :creator org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :creator}).custom_domain)
      |> visit(~p"/learn")
      |> assert_path(~p"/login")
    end

    test "redirects page for :team org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :team}).custom_domain)
      |> visit(~p"/learn")
      |> assert_path(~p"/login")
    end

    test "redirects page for :school org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :school}).custom_domain)
      |> visit(~p"/learn")
      |> assert_path(~p"/login")
    end
  end

  describe "learn subject: results" do
    setup :signup_and_login_user

    test "loads the data", %{conn: conn} do
      data = course_suggestion_fixture()

      conn
      |> visit(~p"/learn/coding")
      |> assert_path(~p"/learn/coding")
      |> assert_has("h3", text: data.title, timeout: 1)
    end

    test "both thumbs up and down are not selected by default", %{conn: conn} do
      course_suggestion_fixture()

      conn
      |> visit(~p"/learn/coding")
      |> assert_has(".tabler-thumb-up", timeout: 1)
      |> assert_has(".tabler-thumb-down")
    end

    test "reacts to content with thumbs up", %{conn: conn, scope: scope} do
      course_suggestion_fixture()

      conn
      |> visit(~p"/learn/coding")
      |> refute_has(".tabler-thumb-up-filled", timeout: 1)
      |> click_button("Thumbs up")
      |> assert_has(".tabler-thumb-up-filled")

      {:ok, course_suggestion} = AI.suggest_courses(scope, %{input: "coding", language: scope.user.language})

      assert Catalog.get_content_reaction(scope, course_suggestion.content_id).reaction == :thumbs_up
    end

    test "reacts to content with thumbs down", %{conn: conn, scope: scope} do
      course_suggestion_fixture()

      conn
      |> visit(~p"/learn/coding")
      |> refute_has(".tabler-thumb-down-filled", timeout: 1)
      |> click_button("Thumbs down")
      |> assert_has(".tabler-thumb-down-filled")

      {:ok, course_suggestion} = AI.suggest_courses(scope, %{input: "coding", language: scope.user.language})

      assert Catalog.get_content_reaction(scope, course_suggestion.content_id).reaction == :thumbs_down
    end
  end
end
