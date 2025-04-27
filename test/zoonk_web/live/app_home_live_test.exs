defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.OrgFixtures

  describe "app home page (unauthenticated)" do
    test "redirects to onboarding for :app org" do
      build_conn()
      |> Map.put(:host, app_org_fixture().custom_domain)
      |> visit(~p"/")
      |> assert_path(~p"/catalog")
    end

    test "redirects to catalog for :creator org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :creator}).custom_domain)
      |> visit(~p"/")
      |> assert_path(~p"/catalog")
    end

    test "redirects to login for :team org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :team}).custom_domain)
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end

    test "redirects to login for :school org" do
      build_conn()
      |> Map.put(:host, org_fixture(%{kind: :school}).custom_domain)
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end
  end
end
