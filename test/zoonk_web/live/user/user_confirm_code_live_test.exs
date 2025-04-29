defmodule ZoonkWeb.User.UserConfirmCodeLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "/confirm/login" do
    test "doesn't redirect when user is logged in", %{conn: conn} do
      user = user_fixture()

      # when in sudo mode, users need to confirm their login
      # so, they need to have access to the confirm page
      conn
      |> login_user(user)
      |> visit(~p"/confirm/login")
      |> assert_path(~p"/confirm/login")
    end

    test "logs the user in with a valid code", %{conn: conn} do
      user = user_fixture()
      otp_code = generate_user_otp_code(user)

      conn
      |> visit(~p"/confirm/login")
      |> fill_in("One-time code", with: otp_code)
      |> submit()
      |> assert_path(~p"/")
    end

    test "shows error with an invalid code", %{conn: conn} do
      conn
      |> visit(~p"/confirm/login")
      |> fill_in("One-time code", with: "invalid_code")
      |> submit()
      |> assert_has("div", text: "Invalid code or account not found.")
      |> assert_path(~p"/confirm/login")
    end
  end

  describe "/confirm/signup" do
    test "redirects when user is logged in", %{conn: conn} do
      user = user_fixture()

      conn
      |> login_user(user)
      |> visit(~p"/confirm/signup")
      |> assert_path(~p"/")
    end

    test "logs the user in with a valid code", %{conn: conn} do
      user = user_fixture()
      otp_code = generate_user_otp_code(user)

      conn
      |> visit(~p"/confirm/signup")
      |> fill_in("One-time code", with: otp_code)
      |> submit()
      |> assert_path(~p"/")
    end

    test "shows error with an invalid code", %{conn: conn} do
      conn
      |> visit(~p"/confirm/signup")
      |> fill_in("One-time code", with: "invalid_code")
      |> submit()
      |> assert_has("div", text: "Invalid code or account not found.")
      |> assert_path(~p"/confirm/signup")
    end
  end

  describe "/confirm/email" do
    setup %{conn: conn} do
      user = user_fixture()
      email = unique_user_email()

      otp_code = extract_otp_code(Accounts.deliver_user_update_email_instructions(%{user | email: email}, user.email))

      %{conn: login_user(conn, user), otp_code: otp_code, email: email, user: user}
    end

    test "updates the user email", %{conn: conn, otp_code: otp_code, email: email, user: user} do
      # user still has the current email address
      assert Accounts.get_user_by_email(user.email)
      refute Accounts.get_user_by_email(email)

      conn
      |> visit(~p"/confirm/email")
      |> fill_in("One-time code", with: otp_code)
      |> submit()
      |> assert_path(~p"/settings")
      |> assert_has("div", text: "Email changed successfully.")

      # user now has the new email address
      refute Accounts.get_user_by_email(user.email)
      assert Accounts.get_user_by_email(email).confirmed_at
    end
  end
end
