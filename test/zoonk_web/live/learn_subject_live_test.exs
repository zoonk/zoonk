defmodule ZoonkWeb.LearnSubjectLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AIFixtures
  import Zoonk.OrgFixtures

  @page_title "What do you want to learn?"

  describe "learn subject (unauthenticated)" do
    test "redirects page for :app org" do
      build_conn()
      |> Map.put(:host, app_org_fixture().custom_domain)
      |> visit(~p"/learn")
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

  describe "learn subject" do
    setup :signup_and_login_user

    test "allows authenticated user to see the page", %{conn: conn} do
      data = course_recommendation_fixture()

      conn
      |> visit(~p"/learn")
      |> assert_path(~p"/learn")
      |> assert_has("h1", text: @page_title)
      |> assert_has(".zk-btn-active", text: "Start course")
      |> refute_has("select")
      |> fill_in("#learn-subject input", "What do you want to learn?", with: "programming")
      |> submit()
      |> assert_path(~p"/learn/programming")
      |> assert_has("h3", text: data.title, timeout: 1)
    end
  end
end
