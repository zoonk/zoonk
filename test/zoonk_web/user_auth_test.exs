defmodule ZoonkWeb.UserAuthTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Phoenix.LiveView
  alias Phoenix.Socket.Broadcast
  alias Zoonk.Accounts
  alias Zoonk.Config.AuthConfig
  alias Zoonk.Orgs
  alias Zoonk.Scope
  alias ZoonkWeb.UserAuth

  @remember_me_cookie AuthConfig.get_cookie_name(:remember_me)
  @max_age AuthConfig.get_max_age(:token, :seconds)

  setup %{conn: conn} do
    user = %{user_fixture() | authenticated_at: DateTime.utc_now()}
    org = app_org_fixture()
    org_member = Orgs.get_org_member(org, user)

    scope =
      %Scope{}
      |> Scope.set(org)
      |> Scope.set(user)
      |> Scope.set(org_member)

    conn =
      conn
      |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{user: user, scope: scope, conn: conn}
  end

  describe "login_user/2" do
    test "stores the user token in the session", %{conn: conn, user: user} do
      conn = UserAuth.login_user(conn, user)
      assert token = get_session(conn, :user_token)
      assert get_session(conn, :live_socket_id) == "users_sessions:#{Base.url_encode64(token)}"
      assert redirected_to(conn) == ~p"/"
      assert Accounts.get_user_by_session_token(token)
    end

    test "clears everything previously stored in the session", %{conn: conn, user: user} do
      conn =
        conn
        |> put_session(:to_be_removed, "value")
        |> UserAuth.login_user(user)

      refute get_session(conn, :to_be_removed)
    end

    test "redirects to the configured path", %{conn: conn, user: user} do
      conn =
        conn
        |> put_session(:user_return_to, "/hello")
        |> UserAuth.login_user(user)

      assert redirected_to(conn) == "/hello"
    end

    test "writes a cookie for the remember_me option", %{conn: conn, user: user} do
      conn =
        conn
        |> fetch_cookies()
        |> UserAuth.login_user(user)

      assert get_session(conn, :user_token) == conn.cookies[@remember_me_cookie]
      assert get_session(conn, :user_remember_me) == true

      assert %{value: signed_token, max_age: max_age} = conn.resp_cookies[@remember_me_cookie]
      assert signed_token != get_session(conn, :user_token)
      assert max_age == @max_age
    end

    test "redirects to settings when user is already logged in", %{conn: conn, scope: scope} do
      conn =
        conn
        |> assign(:current_scope, Scope.set(scope))
        |> UserAuth.login_user(scope.user)

      assert redirected_to(conn) == "/user/email"
    end

    test "writes a cookie if remember_me was set in previous session", %{conn: conn, user: user} do
      conn =
        conn
        |> recycle()
        |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
        |> fetch_cookies()
        |> init_test_session(%{user_remember_me: true})

      # the conn is already logged in and has the remeber_me cookie set,
      # now we log in again and even without explicitly setting remember_me,
      # the cookie should be set again
      next_conn = UserAuth.login_user(conn, user)
      assert %{value: signed_token, max_age: max_age} = next_conn.resp_cookies[@remember_me_cookie]
      assert signed_token != get_session(next_conn, :user_token)
      assert max_age == @max_age
      assert get_session(next_conn, :user_remember_me) == true
    end
  end

  describe "logout_user/1" do
    test "erases session and cookies", %{conn: conn, user: user} do
      user_token = Accounts.generate_user_session_token(user)

      conn =
        conn
        |> put_session(:user_token, user_token)
        |> put_req_cookie(@remember_me_cookie, user_token)
        |> fetch_cookies()
        |> UserAuth.logout_user()

      refute get_session(conn, :user_token)
      refute conn.cookies[@remember_me_cookie]
      assert %{max_age: 0} = conn.resp_cookies[@remember_me_cookie]
      assert redirected_to(conn) == ~p"/"
      refute Accounts.get_user_by_session_token(user_token)
    end

    test "broadcasts to the given live_socket_id", %{conn: conn} do
      live_socket_id = "users_sessions:abcdef-token"
      ZoonkWeb.Endpoint.subscribe(live_socket_id)

      conn
      |> put_session(:live_socket_id, live_socket_id)
      |> UserAuth.logout_user()

      assert_receive %Broadcast{event: "disconnect", topic: ^live_socket_id}
    end

    test "works even if user is already logged out", %{conn: conn} do
      conn =
        conn
        |> fetch_cookies()
        |> UserAuth.logout_user()

      refute get_session(conn, :user_token)
      assert %{max_age: 0} = conn.resp_cookies[@remember_me_cookie]
      assert redirected_to(conn) == ~p"/"
    end
  end

  describe "disconnect_sessions/1" do
    test "broadcasts disconnect messages for each token" do
      tokens = [%{token: "token1"}, %{token: "token2"}]

      for %{token: token} <- tokens do
        ZoonkWeb.Endpoint.subscribe("users_sessions:#{Base.url_encode64(token)}")
      end

      UserAuth.disconnect_sessions(tokens)

      assert_receive %Broadcast{
        event: "disconnect",
        topic: "users_sessions:dG9rZW4x"
      }

      assert_receive %Broadcast{
        event: "disconnect",
        topic: "users_sessions:dG9rZW4y"
      }
    end
  end

  describe "on_mount :mount_current_scope" do
    setup %{conn: conn} do
      %{conn: UserAuth.fetch_current_scope(conn, [])}
    end

    test "assigns current_scope based on a valid user_token", %{conn: conn, user: user} do
      user_token = Accounts.generate_user_session_token(user)

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      {:cont, updated_socket} =
        UserAuth.on_mount(:mount_current_scope, %{}, session, %LiveView.Socket{private: %{connect_info: conn}})

      assert updated_socket.assigns.current_scope.user.id == user.id
    end

    test "assigns nil to current_scope user if there isn't a valid user_token", %{conn: conn} do
      user_token = "invalid_token"

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      {:cont, updated_socket} =
        UserAuth.on_mount(:mount_current_scope, %{}, session, %LiveView.Socket{private: %{connect_info: conn}})

      refute updated_socket.assigns.current_scope.user
    end

    test "assigns nil to current_scope.user if there isn't a user_token", %{conn: conn} do
      session = get_session(conn)

      {:cont, updated_socket} =
        UserAuth.on_mount(:mount_current_scope, %{}, session, %LiveView.Socket{
          private: %{connect_info: conn}
        })

      refute updated_socket.assigns.current_scope.user
    end
  end

  describe "on_mount :ensure_authenticated" do
    test "authenticates current_scope based on a valid user_token", %{conn: conn, user: user} do
      user_token = Accounts.generate_user_session_token(user)

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      {:cont, updated_socket} =
        UserAuth.on_mount(:ensure_authenticated, %{}, session, %LiveView.Socket{private: %{connect_info: conn}})

      assert updated_socket.assigns.current_scope.user.id == user.id
    end

    test "redirects to login page if there isn't a valid user_token", %{conn: conn} do
      user_token = "invalid_token"

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}},
        private: %{connect_info: conn, live_temp: %{}}
      }

      {:halt, updated_socket} = UserAuth.on_mount(:ensure_authenticated, %{}, session, socket)
      refute updated_socket.assigns.current_scope.user
    end

    test "redirects to login page if there isn't a user_token", %{conn: conn} do
      session = get_session(conn)

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}},
        private: %{connect_info: conn, live_temp: %{}}
      }

      {:halt, updated_socket} = UserAuth.on_mount(:ensure_authenticated, %{}, session, socket)
      refute updated_socket.assigns.current_scope.user
    end
  end

  describe "on_mount :ensure_sudo_mode" do
    test "allows users that have authenticated in the last 10 minutes", %{conn: conn, user: user} do
      user_token = Accounts.generate_user_session_token(user)

      session =
        conn
        |> put_session(:user_token, user_token)
        |> get_session()

      socket = %LiveView.Socket{
        endpoint: ZoonkWeb.Endpoint,
        assigns: %{__changed__: %{}, flash: %{}},
        private: %{connect_info: conn, live_temp: %{}}
      }

      assert {:cont, _updated_socket} =
               UserAuth.on_mount(:ensure_sudo_mode, %{}, session, socket)
    end

    test "redirects when authentication is too old", %{scope: scope} do
      %{org: org, user: user, org_member: org_member} = scope

      sudo_mode_minutes = AuthConfig.get_max_age(:sudo_mode, :minutes)
      too_old = DateTime.add(DateTime.utc_now(), sudo_mode_minutes - 1, :minute)
      old_user = %{user | authenticated_at: too_old}

      socket = %LiveView.Socket{
        endpoint: AuthAppWeb.Endpoint,
        assigns: %{
          __changed__: %{},
          flash: %{},
          current_scope: Scope.set(%Scope{user: old_user, org: org, org_member: org_member})
        }
      }

      assert {:halt, _updated_socket} = UserAuth.on_mount(:ensure_sudo_mode, %{}, %{}, socket)
    end
  end

  describe "fetch_current_scope/2" do
    test "authenticates user from session", %{conn: conn, user: user} do
      user_token = Accounts.generate_user_session_token(user)

      conn =
        conn
        |> put_session(:user_token, user_token)
        |> UserAuth.fetch_current_scope([])

      assert conn.assigns.current_scope.user.id == user.id
    end

    test "authenticates user from cookies", %{conn: conn, user: user} do
      logged_in_conn =
        conn
        |> fetch_cookies()
        |> UserAuth.login_user(user)

      user_token = logged_in_conn.cookies[@remember_me_cookie]
      %{value: signed_token} = logged_in_conn.resp_cookies[@remember_me_cookie]

      conn =
        conn
        |> put_req_cookie(@remember_me_cookie, signed_token)
        |> UserAuth.fetch_current_scope([])

      assert conn.assigns.current_scope.user.id == user.id
      assert get_session(conn, :user_token) == user_token

      assert get_session(conn, :live_socket_id) ==
               "users_sessions:#{Base.url_encode64(user_token)}"
    end

    test "does not authenticate if data is missing", %{conn: conn, user: user} do
      Accounts.generate_user_session_token(user)
      conn = UserAuth.fetch_current_scope(conn, [])
      refute get_session(conn, :user_token)
      refute conn.assigns.current_scope.user
    end
  end

  describe "require_authenticated_user/2" do
    setup %{conn: conn} do
      %{conn: UserAuth.fetch_current_scope(conn, [])}
    end

    test "redirects if user is not authenticated", %{conn: conn} do
      conn =
        conn
        |> fetch_flash()
        |> UserAuth.require_authenticated_user([])

      assert conn.halted
      assert redirected_to(conn) == ~p"/login"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "You must log in to access this page."
    end

    test "stores the path to redirect to on GET", %{conn: conn} do
      no_query_conn =
        %{conn | path_info: ["foo"], query_string: ""}
        |> fetch_flash()
        |> UserAuth.require_authenticated_user([])

      assert no_query_conn.halted
      assert get_session(no_query_conn, :user_return_to) == "/foo"

      query_conn =
        %{conn | path_info: ["foo"], query_string: "bar=baz"}
        |> fetch_flash()
        |> UserAuth.require_authenticated_user([])

      assert query_conn.halted
      assert get_session(query_conn, :user_return_to) == "/foo?bar=baz"

      post_conn =
        %{conn | path_info: ["foo"], query_string: "bar", method: "POST"}
        |> fetch_flash()
        |> UserAuth.require_authenticated_user([])

      assert post_conn.halted
      refute get_session(post_conn, :user_return_to)
    end

    test "does not redirect if user is authenticated", %{conn: conn, scope: scope} do
      conn =
        conn
        |> assign(:current_scope, Scope.set(scope))
        |> UserAuth.require_authenticated_user([])

      refute conn.halted
      refute conn.status
    end
  end
end
