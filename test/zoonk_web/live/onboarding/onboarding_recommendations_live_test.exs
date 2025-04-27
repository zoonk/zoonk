defmodule ZoonkWeb.OnboardingRecommendationsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AIFixtures
  import Zoonk.OrgFixtures

  describe "onboarding recommendations (unauthenticated)" do
    test "redirects page for :app org" do
      build_conn()
      |> Map.put(:host, app_org_fixture().custom_domain)
      |> visit(~p"/start/coding")
      |> assert_path(~p"/catalog")
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

  describe "onboarding recommendations" do
    setup :signup_and_login_user

    test "loads the data", %{conn: conn} do
      data = onboarding_recommendation_fixture()

      conn
      |> visit(~p"/start/coding")
      |> assert_path(~p"/start/coding")
      |> assert_has("h3", text: data.title, timeout: 1)
    end
  end
end
