defmodule ZoonkWeb.UserAuthorizationTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Phoenix.LiveView
  alias Zoonk.Scope
  alias ZoonkWeb.UserAuthorization

  setup %{conn: conn} do
    conn =
      conn
      |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{conn: conn}
  end

  describe "require_org_member/2" do
    test "allows access when organization kind is :app", %{conn: conn} do
      user = %{user_fixture() | confirmed_at: nil}
      org = app_org_fixture()
      scope = scope_fixture(%{user: user, org: org, org_member: nil})

      conn =
        conn
        |> assign(:current_scope, scope)
        |> UserAuthorization.require_org_member([])

      refute conn.halted
    end

    test "allows access when organization kind is :creator", %{conn: conn} do
      user = %{user_fixture() | confirmed_at: nil}
      org = org_fixture(%{kind: :creator})
      scope = scope_fixture(%{user: user, org: org, org_member: nil})

      conn =
        conn
        |> assign(:current_scope, scope)
        |> UserAuthorization.require_org_member([])

      refute conn.halted
    end

    test "allows access when user is a confirmed member of the organization", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      conn =
        conn
        |> assign(:current_scope, scope)
        |> UserAuthorization.require_org_member([])

      refute conn.halted
    end

    test "blocks access when user is not confirmed", %{conn: conn} do
      user = %{user_fixture() | confirmed_at: nil}
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, org_member: org_member}

      conn =
        conn
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_member([])

      assert conn.halted
      assert redirected_to(conn) == ~p"/"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "You must be a member of this organization."
    end

    test "blocks access when org_member is nil", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      conn =
        conn
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_member([])

      assert conn.halted
      assert redirected_to(conn) == ~p"/"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "You must be a member of this organization."
    end

    test "blocks access for school organizations when user is not a member", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :school})
      scope = %Scope{user: user, org: org, org_member: nil}

      conn =
        conn
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_member([])

      assert conn.halted
      assert redirected_to(conn) == ~p"/"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "You must be a member of this organization."
    end
  end

  describe "on_mount :ensure_org_member" do
    test "allows access when organization kind is :app" do
      user = %{user_fixture() | confirmed_at: nil}
      org = app_org_fixture()
      scope = scope_fixture(%{user: user, org: org, org_member: nil})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
    end

    test "allows access when organization kind is :creator" do
      user = %{user_fixture() | confirmed_at: nil}
      org = org_fixture(%{kind: :creator})
      scope = scope_fixture(%{user: user, org: org, org_member: nil})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
    end

    test "allows access when user is a confirmed member of the organization" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
    end

    test "redirects when user is not confirmed" do
      user = %{user_fixture() | confirmed_at: nil}
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, org_member: org_member}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert {:halt, redirected_socket} = UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      assert redirected_socket.redirected == {:redirect, %{to: "/login", status: 403}}
      assert redirected_socket.assigns.flash["error"] == "You must be a member of this organization."
    end

    test "redirects when org_member is nil" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert {:halt, redirected_socket} = UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      assert redirected_socket.redirected == {:redirect, %{to: "/login", status: 403}}
      assert redirected_socket.assigns.flash["error"] == "You must be a member of this organization."
    end

    test "redirects for school organizations when user is not a member" do
      user = user_fixture()
      org = org_fixture(%{kind: :school})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert {:halt, redirected_socket} = UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      assert redirected_socket.redirected == {:redirect, %{to: "/login", status: 403}}
      assert redirected_socket.assigns.flash["error"] == "You must be a member of this organization."
    end
  end
end
