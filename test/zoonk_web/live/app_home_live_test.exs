defmodule ZoonkWeb.AppHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Scope

  describe "app home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end
  end

  describe "app home page" do
    setup :signup_and_login_user

    test "renders page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end

    test "navigates to the settings page", %{conn: conn} do
      conn
      |> visit(~p"/")
      |> click_link("Email")
      |> assert_path(~p"/user/email")
    end
  end

  describe "app home page (:app org)" do
    setup [:signup_and_login_user, :setup_app]

    test "allows access for app organization without org membership", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end

    test "allows access for unconfirmed user with app organization", %{conn: conn, org: org} do
      user = %{user_fixture() | confirmed_at: nil}
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end
  end

  describe "app home page (:creator org)" do
    setup [:signup_and_login_user, :setup_creator]

    test "allows access for creator organization without org membership", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end

    test "allows access for unconfirmed user with creator organization", %{conn: conn, org: org} do
      user = %{user_fixture() | confirmed_at: nil}
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end
  end

  describe "app home page (:team org)" do
    setup [:signup_and_login_user, :setup_team]

    test "allows access when user is a confirmed member of the team organization", %{conn: conn, user: user, org: org} do
      org_member = org_member_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, org_member: org_member}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end

    test "redirects when user is not a member of the team organization", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end

    test "redirects when user is a member but not confirmed", %{conn: conn, org: org} do
      user = %{user_fixture() | confirmed_at: nil}
      org_member = org_member_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, org_member: org_member}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end
  end

  describe "app home page (:school org)" do
    setup [:signup_and_login_user, :setup_school]

    test "allows access when user is a confirmed member of the school organization", %{conn: conn, user: user, org: org} do
      org_member = org_member_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, org_member: org_member}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_has("li[aria-current='page']", text: "Summary")
    end

    test "redirects when user is not a member of the school organization", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/")
      |> assert_path(~p"/login")
    end
  end
end
