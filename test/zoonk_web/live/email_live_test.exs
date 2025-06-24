defmodule ZoonkWeb.EmailLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "update email form" do
    setup :signup_and_login_user

    test "redirects to the confirmation page", %{conn: conn, user: user} do
      new_email = unique_user_email()

      conn
      |> visit(~p"/email")
      |> fill_in("Email address", with: new_email)
      |> submit()
      |> assert_path(~p"/confirm/email")

      assert Accounts.get_user_by_email(user.email)
      refute Accounts.get_user_by_email(new_email)
    end

    test "renders errors with invalid data (phx-change)", %{conn: conn} do
      conn
      |> visit(~p"/email")
      |> fill_in("Email address", with: "with spaces")
      |> assert_has("p", text: "must have the @ sign and no spaces")
    end

    test "renders errors with invalid data (phx-submit)", %{conn: conn, user: user} do
      conn
      |> visit(~p"/email")
      |> fill_in("Email address", with: user.email)
      |> submit()
      |> assert_has("p", text: "did not change")
    end
  end
end
