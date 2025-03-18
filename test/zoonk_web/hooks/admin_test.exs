defmodule ZoonkWeb.AdminHookTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Phoenix.LiveView
  alias Zoonk.Accounts
  alias Zoonk.Scope
  alias ZoonkWeb.Hooks

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

      {:halt, _updated_socket} = Hooks.Admin.on_mount(:ensure_user_admin, %{}, session, socket)
    end
  end
end
