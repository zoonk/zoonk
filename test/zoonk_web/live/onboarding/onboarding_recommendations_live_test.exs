defmodule ZoonkWeb.OnboardingRecommendationsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AIFixtures
  import Zoonk.CatalogFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Accounts
  alias Zoonk.Catalog
  alias Zoonk.Scope

  describe "onboarding recommendations (unauthenticated)" do
    test "redirects to /start for :app org" do
      build_conn()
      |> Map.put(:host, app_org_fixture().custom_domain)
      |> visit(~p"/start/coding")
      |> assert_path(~p"/start")
    end

    test "redirects page for :creator org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :creator}).custom_domain)
      |> visit(~p"/start")
      |> assert_path(~p"/catalog")
    end

    test "redirects page for :team org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :team}).custom_domain)
      |> visit(~p"/start")
      |> assert_path(~p"/login")
    end

    test "redirects page for :school org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :school}).custom_domain)
      |> visit(~p"/start")
      |> assert_path(~p"/login")
    end
  end

  describe "onboarding recommendations (guest user)" do
    setup do
      app_org = app_org_fixture()
      conn = Map.put(build_conn(), :host, app_org.custom_domain)
      %{conn: conn, org: app_org}
    end

    test "allows guest user without courses to see the page", %{conn: conn, org: org} do
      {:ok, user} = Accounts.create_guest_user(%{language: "en"}, %Scope{org: org, user: nil})

      # Verify the user is not enrolled in a course
      refute Catalog.user_enrolled_in_any_course?(user.id)

      conn
      |> login_user(user)
      |> visit(~p"/start/coding")
      |> assert_path(~p"/start/coding")
      |> assert_has("h2", text: "We're finding specializations")
    end

    test "redirects guest user with courses to the home page", %{conn: conn, org: org} do
      {:ok, user} = Accounts.create_guest_user(%{language: "en"}, %Scope{org: org, user: nil})
      course = course_fixture()
      course_user_fixture(%{user_id: user.id, course_id: course.id})

      # Verify the user is enrolled in a course
      assert Catalog.user_enrolled_in_any_course?(user.id)

      conn
      |> login_user(user)
      |> visit(~p"/start/coding")
      |> assert_path(~p"/")
    end

    test "loads the data", %{conn: conn, org: org} do
      {:ok, user} = Accounts.create_guest_user(%{language: "en"}, %Scope{org: org, user: nil})

      data = onboarding_recommendation_fixture()

      conn
      |> login_user(user)
      |> visit(~p"/start/coding")
      |> assert_path(~p"/start/coding")
      |> assert_has("h3", text: data.title, timeout: 1)
    end
  end
end
