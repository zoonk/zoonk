defmodule ZoonkWeb.User.UserSettingsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "update email form (regular user)" do
    setup :signup_and_login_user

    test "updates the user email", %{conn: conn, user: user} do
      new_email = unique_user_email()

      conn
      |> visit(~p"/settings")
      |> fill_in("Email address", with: new_email)
      |> submit()
      |> assert_has("div", text: "A link to confirm your email")

      assert Accounts.get_user_by_email(user.email)
    end

    test "renders errors with invalid data (phx-change)", %{conn: conn} do
      conn
      |> visit(~p"/settings")
      |> fill_in("Email address", with: "with spaces")
      |> assert_has("p", text: "must have the @ sign and no spaces")
    end

    test "renders errors with invalid data (phx-submit)", %{conn: conn, user: user} do
      conn
      |> visit(~p"/settings")
      |> fill_in("Email address", with: user.email)
      |> submit()
      |> assert_has("p", text: "did not change")
    end
  end

  describe "confirm email" do
    setup %{conn: conn} do
      user = user_fixture()
      email = unique_user_email()

      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(%{user | email: email}, user.email, url)
        end)

      %{conn: login_user(conn, user), token: token, email: email, user: user}
    end

    test "updates the user email once", %{conn: conn, user: user, token: token, email: email} do
      conn
      |> visit(~p"/settings/confirm/#{token}")
      |> assert_path(~p"/settings")
      |> assert_has("div", text: "Email changed successfully.")

      refute Accounts.get_user_by_email(user.email)
      assert Accounts.get_user_by_email(email)

      # use confirm token again
      conn
      |> visit(~p"/settings/confirm/#{token}")
      |> assert_path(~p"/settings")
      |> assert_has("div", text: "Email change link is invalid or it has expired.")
    end

    test "does not update email with invalid token", %{conn: conn, user: user} do
      conn
      |> visit(~p"/settings/confirm/oops")
      |> assert_path(~p"/settings")
      |> assert_has("div", text: "Email change link is invalid or it has expired.")

      assert Accounts.get_user_by_email(user.email)
    end

    test "redirects if user is not logged in", %{token: token} do
      build_conn()
      |> visit(~p"/settings/confirm/#{token}")
      |> assert_path(~p"/login")
    end
  end
end
