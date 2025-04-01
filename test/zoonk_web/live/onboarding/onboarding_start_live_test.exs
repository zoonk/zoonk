defmodule ZoonkWeb.OnboardingStartLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.OrgFixtures

  describe "onboarding start page (unauthenticated)" do
    test "renders page for :app org" do
      build_conn()
      |> Map.put(:host, app_org_fixture().custom_domain)
      |> visit(~p"/start")
      |> assert_has("h1", text: "Get Started")
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
end
