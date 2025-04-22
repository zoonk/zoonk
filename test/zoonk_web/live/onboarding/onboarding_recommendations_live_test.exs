defmodule ZoonkWeb.OnboardingRecommendationsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.OrgFixtures

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
end
