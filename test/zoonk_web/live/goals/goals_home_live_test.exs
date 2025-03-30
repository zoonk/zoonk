defmodule ZoonkWeb.Goals.GoalsHomeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Scope

  describe "goals home page (unauthenticated)" do
    test "redirects to the login page", %{conn: conn} do
      conn
      |> visit(~p"/goals")
      |> assert_path(~p"/login")
    end
  end

  describe "goals home page (:app org)" do
    setup [:signup_and_login_user, :setup_app]

    test "allows access for app organization without org membership", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/goals")
      |> assert_has("li[aria-current='page']", text: "Goals")
    end

    test "allows access for unconfirmed user with app organization", %{conn: conn, org: org} do
      user = %{user_fixture() | confirmed_at: nil}
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/goals")
      |> assert_has("li[aria-current='page']", text: "Goals")
    end
  end

  describe "goals home page (:creator org)" do
    setup [:signup_and_login_user, :setup_creator]

    test "allows access for creator organization without org membership", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/goals")
      |> assert_has("li[aria-current='page']", text: "Goals")
    end

    test "allows access for unconfirmed user with creator organization", %{conn: conn, org: org} do
      user = %{user_fixture() | confirmed_at: nil}
      scope = %Scope{user: user, org: org, org_member: nil}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/goals")
      |> assert_has("li[aria-current='page']", text: "Goals")
    end
  end

  describe "goals home page (:team org)" do
    setup [:signup_and_login_user, :setup_team]

    test "allows access when user is a confirmed member of the team organization", %{conn: conn, user: user, org: org} do
      org_member = org_member_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, org_member: org_member}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/goals")
      |> assert_has("li[aria-current='page']", text: "Goals")
    end

    test "raises when user is not a member of the team organization", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> assign(:current_scope, scope)
        |> visit(~p"/goals")
      end
    end

    test "raises when user is a member but not confirmed", %{conn: conn, org: org} do
      assert_unconfirmed_member_access_denied(conn, org, ~p"/goals")
    end
  end

  describe "goals home page (:school org)" do
    setup [:signup_and_login_user, :setup_school]

    test "allows access when user is a confirmed member of the school organization", %{conn: conn, user: user, org: org} do
      org_member = org_member_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, org_member: org_member}

      conn
      |> assign(:current_scope, scope)
      |> visit(~p"/goals")
      |> assert_has("li[aria-current='page']", text: "Goals")
    end

    test "raises when user is not a member of the school organization", %{conn: conn, user: user, org: org} do
      scope = %Scope{user: user, org: org, org_member: nil}

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> assign(:current_scope, scope)
        |> visit(~p"/goals")
      end
    end

    test "raises when user is a member but not confirmed", %{conn: conn, org: org} do
      assert_unconfirmed_member_access_denied(conn, org, ~p"/goals")
    end
  end
end
