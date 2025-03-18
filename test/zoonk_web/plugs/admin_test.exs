defmodule ZoonkWeb.AdminPlugTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Admin
  alias Zoonk.Scope
  alias ZoonkWeb.Plugs

  setup %{conn: conn} do
    conn =
      conn
      |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{user: %{user_fixture() | authenticated_at: DateTime.utc_now()}, conn: conn}
  end

  describe "require_admin_user/2" do
    setup %{conn: conn} do
      %{conn: Plugs.UserAuth.fetch_current_scope_for_user(conn, [])}
    end

    test "redirects if user is not admin", %{conn: conn, user: user} do
      conn =
        conn
        |> assign(:current_scope, Scope.for_user(user))
        |> Plugs.Admin.require_admin_user([])

      assert conn.halted

      assert redirected_to(conn) == ~p"/"
    end

    test "does not redirect if user is admin", %{conn: conn, user: user} do
      Admin.add_admin(user.id)

      conn =
        conn
        |> assign(:current_scope, Scope.for_user(user))
        |> Plugs.Admin.require_admin_user([])

      refute conn.halted
      refute conn.status
    end
  end
end
