defmodule ZoonkWeb.OnboardingStartLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.CatalogFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Accounts
  alias Zoonk.Catalog
  alias Zoonk.Scope

  @page_title "What do you want to learn?"

  describe "onboarding start page (unauthenticated)" do
    test "renders page for :app org" do
      build_conn()
      |> Map.put(:host, app_org_fixture().custom_domain)
      |> visit(~p"/start")
      |> assert_has("h1", text: @page_title)
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

  describe "onboarding start page (authenticated)" do
    setup :signup_and_login_user

    test "redirects to the home page", %{conn: conn} do
      conn
      |> visit(~p"/start")
      |> assert_path(~p"/")
    end
  end

  describe "onboarding start page (guest user)" do
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
      |> visit(~p"/start")
      |> assert_path(~p"/start")
      |> assert_has("h1", text: @page_title)
    end

    test "redirects guest user with courses to the home page", %{conn: conn, org: org} do
      {:ok, user} = Accounts.create_guest_user(%{language: "en"}, %Scope{org: org, user: nil})
      course = course_fixture()
      course_user_fixture(%{user_id: user.id, course_id: course.id})

      # Verify the user is enrolled in a course
      assert Catalog.user_enrolled_in_any_course?(user.id)

      conn
      |> login_user(user)
      |> visit(~p"/start")
      |> assert_path(~p"/")
    end
  end
end
