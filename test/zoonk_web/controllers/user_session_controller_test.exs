defmodule ZoonkWeb.UserSessionControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AuthFixtures

  alias Zoonk.Auth

  setup do
    %{unconfirmed_user: unconfirmed_user_fixture(), user: user_fixture()}
  end

  describe "POST /users/signin - magic link" do
    test "logs the user in", %{conn: conn, user: user} do
      {token, _hashed_token} = generate_user_magic_link_token(user)

      post_conn =
        post(conn, ~p"/users/signin", %{
          "user" => %{"token" => token}
        })

      assert get_session(post_conn, :user_token)
      assert redirected_to(post_conn) == ~p"/"

      # Now do a logged in request and assert on the menu
      loggedin_conn = get(post_conn, ~p"/")
      response = html_response(loggedin_conn, 200)
      assert response =~ user.email
      assert response =~ ~p"/users/settings"
      assert response =~ ~p"/users/log-out"
    end

    test "confirms unconfirmed user", %{conn: conn, unconfirmed_user: user} do
      {token, _hashed_token} = generate_user_magic_link_token(user)
      refute user.confirmed_at

      post_conn =
        post(conn, ~p"/users/signin", %{
          "user" => %{"token" => token},
          "_action" => "confirmed"
        })

      assert get_session(post_conn, :user_token)
      assert redirected_to(post_conn) == ~p"/"
      assert Phoenix.Flash.get(post_conn.assigns.flash, :info) =~ "User confirmed successfully."

      assert Auth.get_user!(user.id).confirmed_at

      # Now do a logged in request and assert on the menu
      loggedin_conn = get(post_conn, ~p"/")
      response = html_response(loggedin_conn, 200)
      assert response =~ user.email
      assert response =~ ~p"/users/settings"
      assert response =~ ~p"/users/log-out"
    end

    test "redirects to login page when magic link is invalid", %{conn: conn} do
      conn =
        post(conn, ~p"/users/signin", %{
          "user" => %{"token" => "invalid"}
        })

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "The link is invalid or it has expired."

      assert redirected_to(conn) == ~p"/users/signin"
    end
  end

  describe "DELETE /users/log-out" do
    test "logs the user out", %{conn: conn, user: user} do
      conn =
        conn
        |> log_in_user(user)
        |> delete(~p"/users/log-out")

      assert redirected_to(conn) == ~p"/"
      refute get_session(conn, :user_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end

    test "succeeds even if the user is not logged in", %{conn: conn} do
      conn = delete(conn, ~p"/users/log-out")
      assert redirected_to(conn) == ~p"/"
      refute get_session(conn, :user_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end
  end
end
