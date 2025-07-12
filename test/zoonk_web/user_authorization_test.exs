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

  describe "on_mount :ensure_org_member" do
    test "allows access when user is a confirmed member of the organization" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
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
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil on :app org" do
      user = user_fixture()
      org = org_fixture(%{kind: :app})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil on :creator org" do
      user = user_fixture()
      org = org_fixture(%{kind: :creator})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil on :team org" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil on :school org" do
      user = user_fixture()
      org = org_fixture(%{kind: :school})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
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
        view: ZoonkWeb.AppHomeLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
    end

    test "allows access when user is admin and path starts with /editor" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        view: DocumentsLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
    end

    test "allows access when user is admin and path starts with /org" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :admin})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        view: ZoonkWeb.Org.OrgSettingsLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert {:cont, _socket} = UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
    end

    test "redirects when user is not admin and path starts with /editor" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      org_member = org_member_fixture(%{user: user, org: org, role: :member})
      scope = scope_fixture(%{user: user, org: org, org_member: org_member})

      socket = %LiveView.Socket{
        view: ZoonkWeb.Editor.NotAdminLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

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
        view: ZoonkWeb.Org.OrgHomeLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

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
        view: ZoonkWeb.Org.NotConfirmedUserLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil for admin paths" do
      user = user_fixture()
      org = org_fixture(%{kind: :team})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        view: ZoonkWeb.Org.NotMemberLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

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
        view: ZoonkWeb.Org.NotAdminLive,
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_admin, %{}, %{}, socket)
      end
    end
  end
end
