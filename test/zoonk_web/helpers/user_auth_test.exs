defmodule ZoonkWeb.UserAuthHelperTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AuthFixtures

  alias Phoenix.Socket.Broadcast
  alias Zoonk.Auth
  alias Zoonk.Configuration
  alias ZoonkWeb.Helpers

  @remember_me_cookie Configuration.get_remember_me_cookie_name()
  @max_age Configuration.get_token_max_age_in_seconds()

  setup %{conn: conn} do
    conn =
      conn
      |> Map.replace!(:secret_key_base, ZoonkWeb.Endpoint.config(:secret_key_base))
      |> init_test_session(%{})

    %{user: %{user_fixture() | authenticated_at: DateTime.utc_now()}, conn: conn}
  end

  describe "signin_user/2" do
    test "stores the user token in the session", %{conn: conn, user: user} do
      conn = Helpers.UserAuth.signin_user(conn, user)
      assert token = get_session(conn, :user_token)
      assert get_session(conn, :live_socket_id) == "users_sessions:#{Base.url_encode64(token)}"
      assert redirected_to(conn) == ~p"/"
      assert Auth.get_user_by_session_token(token)
    end

    test "clears everything previously stored in the session", %{conn: conn, user: user} do
      conn =
        conn
        |> put_session(:to_be_removed, "value")
        |> Helpers.UserAuth.signin_user(user)

      refute get_session(conn, :to_be_removed)
    end

    test "redirects to the configured path", %{conn: conn, user: user} do
      conn =
        conn
        |> put_session(:user_return_to, "/hello")
        |> Helpers.UserAuth.signin_user(user)

      assert redirected_to(conn) == "/hello"
    end

    test "writes a cookie for the remember_me option", %{conn: conn, user: user} do
      conn =
        conn
        |> fetch_cookies()
        |> Helpers.UserAuth.signin_user(user)

      assert get_session(conn, :user_token) == conn.cookies[@remember_me_cookie]
      assert get_session(conn, :user_remember_me) == true

      assert %{value: signed_token, max_age: max_age} = conn.resp_cookies[@remember_me_cookie]
      assert signed_token != get_session(conn, :user_token)
      assert max_age == @max_age
    end

    test "redirects to settings when user is already logged in", %{conn: conn, user: user} do
      conn =
        conn
        |> assign(:current_user, user)
        |> Helpers.UserAuth.signin_user(user)

      assert redirected_to(conn) == "/users/settings"
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
      next_conn = Helpers.UserAuth.signin_user(conn, user)
      assert %{value: signed_token, max_age: max_age} = next_conn.resp_cookies[@remember_me_cookie]
      assert signed_token != get_session(next_conn, :user_token)
      assert max_age == @max_age
      assert get_session(next_conn, :user_remember_me) == true
    end
  end

  describe "signout_user/1" do
    test "erases session and cookies", %{conn: conn, user: user} do
      user_token = Auth.generate_user_session_token(user)

      conn =
        conn
        |> put_session(:user_token, user_token)
        |> put_req_cookie(@remember_me_cookie, user_token)
        |> fetch_cookies()
        |> Helpers.UserAuth.signout_user()

      refute get_session(conn, :user_token)
      refute conn.cookies[@remember_me_cookie]
      assert %{max_age: 0} = conn.resp_cookies[@remember_me_cookie]
      assert redirected_to(conn) == ~p"/"
      refute Auth.get_user_by_session_token(user_token)
    end

    test "broadcasts to the given live_socket_id", %{conn: conn} do
      live_socket_id = "users_sessions:abcdef-token"
      ZoonkWeb.Endpoint.subscribe(live_socket_id)

      conn
      |> put_session(:live_socket_id, live_socket_id)
      |> Helpers.UserAuth.signout_user()

      assert_receive %Broadcast{event: "disconnect", topic: ^live_socket_id}
    end

    test "works even if user is already logged out", %{conn: conn} do
      conn =
        conn
        |> fetch_cookies()
        |> Helpers.UserAuth.signout_user()

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

      Helpers.UserAuth.disconnect_sessions(tokens)

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
end
