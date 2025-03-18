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

    %{user_identity: user_identity, user_profile: user_profile} = user_fixture(%{preload: :user})

    %{user_identity: %{user_identity | authenticated_at: DateTime.utc_now()}, user_profile: user_profile, conn: conn}
  end

  describe "require_admin_user/2" do
    setup %{conn: conn} do
      %{conn: Plugs.UserAuth.fetch_current_scope_for_user(conn, [])}
    end

    test "redirects if user is not admin", %{conn: conn, user_identity: user_identity} do
      conn =
        conn
        |> assign(:current_scope, Scope.for_user(user_identity))
        |> Plugs.Admin.require_admin_user([])

      assert conn.halted

      assert redirected_to(conn) == ~p"/"
    end

    test "does not redirect if user is admin", %{conn: conn, user_profile: user_profile, user_identity: user_identity} do
      Admin.add_admin(user_profile)

      conn =
        conn
        |> assign(:current_scope, Scope.for_user(user_identity))
        |> Plugs.Admin.require_admin_user([])

      refute conn.halted
      refute conn.status
    end
  end
end
