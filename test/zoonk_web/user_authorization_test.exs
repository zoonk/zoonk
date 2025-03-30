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

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_member([])
      end
    end

    test "blocks access when org_member is nil", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_member([])
      end
    end

    test "blocks access for school organizations when user is not a member", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :school})
      scope = %Scope{user: user, org: org, org_member: nil}

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_member([])
      end
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

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end

    test "redirects for school organizations when user is not a member" do
      user = user_fixture()
      org = org_fixture(%{kind: :school})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end
  end

  describe "require_org_admin/2" do
    test "allows access when path doesn't start with admin paths", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      conn =
        conn
        |> Map.put(:request_path, "/dashboard")
        |> assign(:current_scope, scope)
        |> UserAuthorization.require_org_admin([])

      refute conn.halted
    end

    test "allows access when user is admin and path starts with /editor", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      conn =
        conn
        |> Map.put(:request_path, "/editor/documents")
        |> assign(:current_scope, scope)
        |> UserAuthorization.require_org_admin([])

      refute conn.halted
    end

    test "allows access when user is admin and path starts with /org", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      conn =
        conn
        |> Map.put(:request_path, "/org/settings")
        |> assign(:current_scope, scope)
        |> UserAuthorization.require_org_admin([])

      refute conn.halted
    end

    test "blocks access when user is not admin and path starts with /editor", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> Map.put(:request_path, "/editor/documents")
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_admin([])
      end
    end

    test "blocks access when user is not admin and path starts with /org", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> Map.put(:request_path, "/org/settings")
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_admin([])
      end
    end

    test "blocks access when user is not confirmed even for admin paths", %{conn: conn} do
      user = %{user_fixture() | confirmed_at: nil}
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = %Scope{user: user, org: org, org_member: org_member}

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> Map.put(:request_path, "/editor/documents")
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_admin([])
      end
    end

    test "blocks access when org_member is nil for admin paths", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> Map.put(:request_path, "/editor/documents")
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_admin([])
      end
    end

    test "blocks access for public orgs when user is not admin for admin paths", %{conn: conn} do
      user = user_fixture()
      org = org_fixture(%{kind: :app})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      assert_raise ZoonkWeb.PermissionError, fn ->
        conn
        |> Map.put(:request_path, "/editor/documents")
        |> assign(:current_scope, scope)
        |> fetch_flash()
        |> UserAuthorization.require_org_admin([])
      end
    end
  end

  describe "on_mount :ensure_org_admin" do
    test "allows access when path doesn't start with admin paths" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/dashboard"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
    end

    test "allows access when user is admin and path starts with /editor" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/editor/documents"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
    end

    test "allows access when user is admin and path starts with /org" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/org/settings"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
    end

    test "redirects when user is not admin and path starts with /editor" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/editor/documents"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
      end
    end

    test "redirects when user is not admin and path starts with /org" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/org/settings"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
      end
    end

    test "redirects when user is not confirmed even for admin paths" do
      user = %{user_fixture() | confirmed_at: nil}
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = %Scope{user: user, org: org, org_member: org_member}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/editor/documents"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil for admin paths" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/editor/documents"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
      end
    end

    test "redirects for public orgs when user is not admin for admin paths" do
      user = user_fixture()
      org = org_fixture(%{kind: :app})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: scope}
      }

      uri = %URI{path: "/editor/documents"}

      socket = %{socket | private: %{connect_info: %{uri: uri}}}

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
      end
    end
  end
end
