defmodule ZoonkWeb.UserAuthPlugTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AuthFixtures

  alias Zoonk.Auth
  alias Zoonk.Configuration
  alias ZoonkWeb.Helpers
  alias ZoonkWeb.Plugs

  @remember_me_cookie Configuration.get_cookie_name(:remember_me)

  setup %{conn: conn} do
    conn =
      conn
      |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{user: %{user_fixture() | authenticated_at: DateTime.utc_now()}, conn: conn}
  end

  describe "fetch_current_user/2" do
    test "authenticates user from session", %{conn: conn, user: user} do
      user_token = Auth.generate_user_session_token(user)

      conn =
        conn
        |> put_session(:user_token, user_token)
        |> Plugs.UserAuth.fetch_current_user([])

      assert conn.assigns.current_user.id == user.id
    end

    test "authenticates user from cookies", %{conn: conn, user: user} do
      logged_in_conn =
        conn
        |> fetch_cookies()
        |> Helpers.UserAuth.signin_user(user)

      user_token = logged_in_conn.cookies[@remember_me_cookie]
      %{value: signed_token} = logged_in_conn.resp_cookies[@remember_me_cookie]

      conn =
        conn
        |> put_req_cookie(@remember_me_cookie, signed_token)
        |> Plugs.UserAuth.fetch_current_user([])

      assert conn.assigns.current_user.id == user.id
      assert get_session(conn, :user_token) == user_token

      assert get_session(conn, :live_socket_id) ==
               "users_sessions:#{Base.url_encode64(user_token)}"
    end

    test "does not authenticate if data is missing", %{conn: conn, user: user} do
      Auth.generate_user_session_token(user)
      conn = Plugs.UserAuth.fetch_current_user(conn, [])
      refute get_session(conn, :user_token)
      refute conn.assigns.current_user
    end
  end

  describe "require_authenticated_user/2" do
    test "redirects if user is not authenticated", %{conn: conn} do
      conn =
        conn
        |> fetch_flash()
        |> Plugs.UserAuth.require_authenticated_user([])

      assert conn.halted

      assert redirected_to(conn) == ~p"/login"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "You must log in to access this page."
    end

    test "stores the path to redirect to on GET", %{conn: conn} do
      no_query_conn =
        %{conn | path_info: ["foo"], query_string: ""}
        |> fetch_flash()
        |> Plugs.UserAuth.require_authenticated_user([])

      assert no_query_conn.halted
      assert get_session(no_query_conn, :user_return_to) == "/foo"

      query_conn =
        %{conn | path_info: ["foo"], query_string: "bar=baz"}
        |> fetch_flash()
        |> Plugs.UserAuth.require_authenticated_user([])

      assert query_conn.halted
      assert get_session(query_conn, :user_return_to) == "/foo?bar=baz"

      post_conn =
        %{conn | path_info: ["foo"], query_string: "bar", method: "POST"}
        |> fetch_flash()
        |> Plugs.UserAuth.require_authenticated_user([])

      assert post_conn.halted
      refute get_session(post_conn, :user_return_to)
    end

    test "does not redirect if user is authenticated", %{conn: conn, user: user} do
      conn =
        conn
        |> assign(:current_user, user)
        |> Plugs.UserAuth.require_authenticated_user([])

      refute conn.halted
      refute conn.status
    end
  end
end
