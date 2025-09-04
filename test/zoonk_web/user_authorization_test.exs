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
      org = org_fixture(%{kind: :external})
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
      org = org_fixture(%{kind: :external})
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

    test "redirects when org_member is nil on :system org" do
      user = user_fixture()
      org = org_fixture(%{kind: :system})
      scope = %Scope{user: user, org: org, org_member: nil}

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, scope: scope}
      }

      assert_raise ZoonkWeb.PermissionError, fn ->
        UserAuthorization.on_mount(:ensure_org_member, %{}, %{}, socket)
      end
    end

    test "redirects when org_member is nil on :external org" do
      user = user_fixture()
      org = org_fixture(%{kind: :external, is_public: true})
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
end
