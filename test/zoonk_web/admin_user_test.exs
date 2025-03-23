defmodule ZoonkWeb.Admin.AdminUserTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Phoenix.LiveView
  alias Zoonk.Accounts
  alias Zoonk.Admin
  alias Zoonk.Scope
  alias ZoonkWeb.Accounts.UserAuth
  alias ZoonkWeb.Admin.AdminUser

  setup %{conn: conn} do
    conn =
      conn
      |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{user: %{user_fixture() | authenticated_at: DateTime.utc_now()}, conn: conn}
  end

  describe "on_mount :ensure_user_admin" do
    test "redirects to home page if user is not an admin", %{conn: conn, user: user} do
      user_token = Accounts.generate_user_session_token(user)

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      socket = %LiveView.Socket{
        endpoint: AuthAppWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}, current_scope: Scope.for_user(user)}
      }

      {:halt, _updated_socket} = AdminUser.on_mount(:ensure_user_admin, %{}, session, socket)
    end
  end

  describe "require_admin_user/2" do
    setup %{conn: conn} do
      %{conn: UserAuth.fetch_current_scope_for_user(conn, [])}
    end

    test "redirects if user is not admin", %{conn: conn, user: user} do
      conn =
        conn
        |> assign(:current_scope, Scope.for_user(user))
        |> AdminUser.require_admin_user([])

      assert conn.halted

      assert redirected_to(conn) == ~p"/"
    end

    test "does not redirect if user is admin", %{conn: conn, user: user} do
      Admin.create_admin_user(user.id)

      conn =
        conn
        |> assign(:current_scope, Scope.for_user(user))
        |> AdminUser.require_admin_user([])

      refute conn.halted
      refute conn.status
    end
  end
end
