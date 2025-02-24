defmodule ZoonkWeb.UserLive.ConfirmationTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AuthFixtures

  alias Zoonk.Auth

  setup do
    %{unconfirmed_user: unconfirmed_user_fixture(), confirmed_user: user_fixture()}
  end

  describe "Confirm user" do
    test "renders confirmation page for unconfirmed user", %{conn: conn, unconfirmed_user: user} do
      token =
        extract_user_token(fn url ->
          Auth.deliver_signin_instructions(user, url)
        end)

      {:ok, _lv, html} = live(conn, ~p"/login/#{token}")
      assert html =~ "Confirm my account"
    end

    test "renders signin page for confirmed user", %{conn: conn, confirmed_user: user} do
      token =
        extract_user_token(fn url ->
          Auth.deliver_signin_instructions(user, url)
        end)

      {:ok, _lv, html} = live(conn, ~p"/login/#{token}")
      refute html =~ "Confirm my account"
      assert html =~ "Log in"
    end

    test "confirms the given token once", %{conn: conn, unconfirmed_user: user} do
      token =
        extract_user_token(fn url ->
          Auth.deliver_signin_instructions(user, url)
        end)

      {:ok, lv, _html} = live(conn, ~p"/login/#{token}")

      form = form(lv, "#confirmation_form", %{"user" => %{"token" => token}})
      render_submit(form)

      trigger_conn = follow_trigger_action(form, conn)

      assert Phoenix.Flash.get(trigger_conn.assigns.flash, :info) =~
               "User confirmed successfully"

      assert Auth.get_user!(user.id).confirmed_at
      # we are logged in now
      assert get_session(trigger_conn, :user_token)
      assert redirected_to(trigger_conn) == ~p"/"

      # log out, new conn
      signout_conn = build_conn()

      {:ok, _lv, html} =
        signout_conn
        |> live(~p"/login/#{token}")
        |> follow_redirect(signout_conn, ~p"/login")

      assert html =~ "Magic link is invalid or it has expired"
    end

    test "logs confirmed user in without changing confirmed_at", %{
      conn: conn,
      confirmed_user: user
    } do
      token =
        extract_user_token(fn url ->
          Auth.deliver_signin_instructions(user, url)
        end)

      {:ok, lv, _html} = live(conn, ~p"/login/#{token}")

      form = form(lv, "#signin_form", %{"user" => %{"token" => token}})
      render_submit(form)

      trigger_conn = follow_trigger_action(form, conn)

      assert Phoenix.Flash.get(trigger_conn.assigns.flash, :info) =~
               "Welcome back!"

      assert Auth.get_user!(user.id).confirmed_at == user.confirmed_at

      # log out, new conn
      signout_conn = build_conn()

      {:ok, _lv, html} =
        signout_conn
        |> live(~p"/login/#{token}")
        |> follow_redirect(signout_conn, ~p"/login")

      assert html =~ "Magic link is invalid or it has expired"
    end

    test "raises error for invalid token", %{conn: conn} do
      {:ok, _lv, html} =
        conn
        |> live(~p"/login/invalid-token")
        |> follow_redirect(conn, ~p"/login")

      assert html =~ "Magic link is invalid or it has expired"
    end
  end
end
