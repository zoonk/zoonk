defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.OrgFixtures

  describe "app home page (unauthenticated)" do
    test "redirects to catalog for system org" do
      build_conn()
      |> Map.put(:host, system_org_fixture().custom_domain)
      |> visit(~p"/")
      |> assert_path(~p"/catalog")
    end

    test "redirects to catalog for public external org" do
      org = org_fixture(%{kind: :external, is_public: true})

      build_conn()
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/")
      |> assert_path(~p"/catalog")
    end

    test "redirects to login for private external org" do
      org = org_fixture(%{kind: :external, is_public: false})

      build_conn()
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end
  end

  describe "app home page (authenticated to system org)" do
    setup :signup_and_login_user

    test "selects the home page menu", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> assert_path(~p"/")
      |> assert_has("a", text: "Start new course")
      |> assert_has("a", text: "Create organization")
      |> assert_has("a", text: "Create new organization")
      |> assert_has(".zk-btn-active", text: "Home")
      |> refute_has(".zk-btn-active", text: "Catalog")
    end
  end

  describe "app home page (authenticated to public external org)" do
    setup :signup_and_login_user_for_public_external_org

    test "don't show restricted menus", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> refute_has("a", text: "Start course")
      |> refute_has("a", text: "Start new course")
      |> refute_has("a", text: "Create organization")
      |> refute_has("a", text: "Create new organization")
    end
  end

  describe "app home page (authenticated to private external org)" do
    setup :signup_and_login_user_for_private_external_org

    test "don't show restricted menus", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> refute_has("a", text: "Start course")
      |> refute_has("a", text: "Start new course")
      |> refute_has("a", text: "Create organization")
      |> refute_has("a", text: "Create new organization")
    end
  end
end
