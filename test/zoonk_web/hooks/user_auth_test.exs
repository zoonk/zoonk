defmodule ZoonkWeb.UserAuthHookTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Phoenix.LiveView
  alias Zoonk.Accounts
  alias Zoonk.Accounts.Scope
  alias Zoonk.Configuration
  alias Zoonk.Schemas.UserIdentity
  alias ZoonkWeb.Hooks
  alias ZoonkWeb.Plugs

  setup %{conn: conn} do
    conn =
      conn
      |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{user_identity: user_identity} = user_fixture()

    %{user_identity: %{user_identity | authenticated_at: DateTime.utc_now()}, conn: conn}
  end

  describe "on_mount :mount_current_scope" do
    setup %{conn: conn} do
      %{conn: Plugs.UserAuth.fetch_current_scope_for_user(conn, [])}
    end

    test "assigns current_scope based on a valid user_token", %{
      conn: conn,
      user_identity: %UserIdentity{} = user_identity
    } do
      user_token = Accounts.generate_user_session_token(user_identity)

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      {:cont, updated_socket} =
        Hooks.UserAuth.on_mount(:mount_current_scope, %{}, session, %LiveView.Socket{})

      assert updated_socket.assigns.current_scope.user.id == user_identity.user.id
    end

    test "assigns nil to current_scope assign if there isn't a valid user_token", %{conn: conn} do
      user_token = "invalid_token"

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      {:cont, updated_socket} =
        Hooks.UserAuth.on_mount(:mount_current_scope, %{}, session, %LiveView.Socket{})

      assert updated_socket.assigns.current_scope == nil
    end

    test "assigns nil to current_scope assign if there isn't a user_token", %{conn: conn} do
      session = get_session(conn)

      {:cont, updated_socket} =
        Hooks.UserAuth.on_mount(:mount_current_scope, %{}, session, %LiveView.Socket{})

      assert updated_socket.assigns.current_scope == nil
    end
  end

  describe "on_mount :ensure_authenticated" do
    test "authenticates current_scope based on a valid user_token", %{
      conn: conn,
      user_identity: %UserIdentity{} = user_identity
    } do
      user_token = Accounts.generate_user_session_token(user_identity)

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      {:cont, updated_socket} =
        Hooks.UserAuth.on_mount(:ensure_authenticated, %{}, session, %LiveView.Socket{})

      assert updated_socket.assigns.current_scope.user.id == user_identity.user.id
    end

    test "redirects to login page if there isn't a valid user_token", %{conn: conn} do
      user_token = "invalid_token"

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}}
      }

      {:halt, updated_socket} = Hooks.UserAuth.on_mount(:ensure_authenticated, %{}, session, socket)
      assert updated_socket.assigns.current_scope == nil
    end

    test "redirects to login page if there isn't a user_token", %{conn: conn} do
      session = get_session(conn)

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}}
      }

      {:halt, updated_socket} = Hooks.UserAuth.on_mount(:ensure_authenticated, %{}, session, socket)
      assert updated_socket.assigns.current_scope == nil
    end
  end

  describe "on_mount :ensure_sudo_mode" do
    test "allows users that have authenticated in the last 10 minutes", %{
      conn: conn,
      user_identity: %UserIdentity{} = user_identity
    } do
      user_token = Accounts.generate_user_session_token(user_identity)

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}}
      }

      assert {:cont, _updated_socket} =
               Hooks.UserAuth.on_mount(:ensure_sudo_mode, %{}, session, socket)
    end

    test "redirects when authentication is too old", %{user_identity: %UserIdentity{} = user_identity} do
      sudo_mode_minutes = Configuration.get_max_age(:sudo_mode, :minutes)
      too_old = DateTime.add(DateTime.utc_now(), sudo_mode_minutes - 1, :minute)

      socket = %LiveView.Socket{
        endpoint: AuthAppWeb.Endpoint,
        assigns: %{
          __changed__: %{},
          flash: %{},
          current_scope: Scope.for_user(%{user_identity | authenticated_at: too_old})
        }
      }

      assert {:halt, _updated_socket} =
               Hooks.UserAuth.on_mount(:ensure_sudo_mode, %{}, %{}, socket)
    end
  end
end
