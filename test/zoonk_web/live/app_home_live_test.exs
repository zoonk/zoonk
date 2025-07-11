defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.OrgFixtures

  describe "app home page (unauthenticated)" do
    test "redirects to catalog for :app org" do
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

  describe "app home page (authenticated)" do
    setup :signup_and_login_user

    test "selects the home page menu", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> assert_path(~p"/")
      |> assert_has(".zk-btn-black", text: "Home")
      |> refute_has(".zk-btn-black", text: "Catalog")
    end
  end
end
