defmodule ZoonkWeb.OrgNewLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.OrgFixtures

  describe "/orgs/new (unauthenticated)" do
    test "redirects page for system org" do
      build_conn()
      |> Map.put(:host, system_org_fixture().custom_domain)
      |> visit(~p"/orgs/new")
      |> assert_path(~p"/login")
    end
  end

  describe "/orgs/new (authenticated for system org)" do
    setup :signup_and_login_user

    test "fills in all steps", %{conn: conn, scope: scope} do
      unique_subdomain = "my-org-#{System.unique_integer([:positive])}"

      conn
      |> visit(~p"/orgs/new")
      |> assert_has("li[aria-current='step']", text: "Start")
      |> assert_has("h1", text: "Set up your organization")
      |> click_button("Next")
      |> refute_has("h1", text: "Set up your organization")
      |> assert_has("li[aria-current='step']", text: "Name")
      |> fill_in("Name", with: "My Organization")
      |> submit()
      |> refute_has("label", text: "Name")
      |> assert_has("li[aria-current='step']", text: "Subdomain")
      |> assert_has("li[aria-current='step']", count: 1)
      |> fill_in("Subdomain", with: scope.org.subdomain)
      |> assert_has("p", text: "has already been taken")
      |> fill_in("Subdomain", with: unique_subdomain)
      |> submit()
      |> refute_has("label", text: "Subdomain")
      |> assert_has("li[aria-current='step']", text: "Visibility")
      |> assert_has("input[checked]", value: "false")
      |> choose("Public", exact: false)
      |> assert_has("input[checked]", value: "true")
      |> submit()
      |> refute_has("input[checked]")
      |> assert_has("li[aria-current='step']", text: "Mode")
    end

    test "keeps values when clicking on previous", %{conn: conn} do
      org_name = "My Organization"
      unique_subdomain = "my-org-#{System.unique_integer([:positive])}"

      conn
      |> visit(~p"/orgs/new")
      |> click_button("Next")
      |> fill_in("Name", with: org_name)
      |> submit()
      |> fill_in("Subdomain", with: unique_subdomain)
      |> submit()
      |> click_button("Previous")
      |> assert_has("input", label: "Subdomain", value: unique_subdomain)
      |> click_button("Previous")
      |> assert_has("input", label: "Name", value: org_name)
    end
  end

  describe "/orgs/new (authenticated for non-system org)" do
    setup :signup_and_login_user_for_public_external_org

    test "redirects to login page", %{conn: conn} do
      error =
        assert_raise ZoonkWeb.PermissionError, fn ->
          visit(conn, ~p"/orgs/new")
        end

      assert error.message =~ "You don't have permission to access this page"
    end
  end
end
