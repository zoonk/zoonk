defmodule ZoonkWeb.UserLive.UserEmailSettingsTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "Email settings page" do
    test "renders settings page", %{conn: conn} do
      {:ok, _lv, html} =
        conn
        |> login_user(user_fixture())
        |> live(~p"/user/email")

      assert html =~ "Change Email"
    end

    test "logout user", %{conn: conn} do
      {:ok, lv, _html} =
        conn
        |> login_user(user_fixture())
        |> live(~p"/user/email")

      assert {:ok, _conn} =
               lv
               |> element("a", "Logout")
               |> render_click()
               |> follow_redirect(conn, ~p"/logout")
    end

    test "redirects if user is not logged in", %{conn: conn} do
      assert {:error, redirect} = live(conn, ~p"/user/email")

      assert {:redirect, %{to: path, flash: flash}} = redirect
      assert path == ~p"/login"
      assert %{"error" => "You must log in to access this page."} = flash
    end
  end

  describe "update email form" do
    setup %{conn: conn} do
      user = user_fixture()
      %{conn: login_user(conn, user), user: user}
    end

    test "updates the user email", %{conn: conn, user: user} do
      new_email = unique_user_email()

      {:ok, lv, _html} = live(conn, ~p"/user/email")

      result =
        lv
        |> form("#email_form", %{
          "user" => %{"email" => new_email}
        })
        |> render_submit()

      assert result =~ "A link to confirm your email"
      assert Accounts.get_user_by_email(user.email)
    end

    test "renders errors with invalid data (phx-change)", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/user/email")

      result =
        lv
        |> element("#email_form")
        |> render_change(%{
          "action" => "update_email",
          "user" => %{"email" => "with spaces"}
        })

      assert result =~ "Change Email"
      assert result =~ "must have the @ sign and no spaces"
    end

    test "renders errors with invalid data (phx-submit)", %{conn: conn, user: user} do
      {:ok, lv, _html} = live(conn, ~p"/user/email")

      result =
        lv
        |> form("#email_form", %{
          "user" => %{"email" => user.email}
        })
        |> render_submit()

      assert result =~ "Change Email"
      assert result =~ "did not change"
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
      {:error, redirect} = live(conn, ~p"/user/email/confirm/#{token}")

      assert {:live_redirect, %{to: path, flash: flash}} = redirect
      assert path == ~p"/user/email"
      assert %{"info" => message} = flash
      assert message == "Email changed successfully."
      refute Accounts.get_user_by_email(user.email)
      assert Accounts.get_user_by_email(email)

      # use confirm token again
      {:error, expired_redirect} = live(conn, ~p"/user/email/confirm/#{token}")
      assert {:live_redirect, %{to: path, flash: flash}} = expired_redirect
      assert path == ~p"/user/email"
      assert %{"error" => message} = flash
      assert message == "Email change link is invalid or it has expired."
    end

    test "does not update email with invalid token", %{conn: conn, user: user} do
      {:error, redirect} = live(conn, ~p"/user/email/confirm/oops")
      assert {:live_redirect, %{to: path, flash: flash}} = redirect
      assert path == ~p"/user/email"
      assert %{"error" => message} = flash
      assert message == "Email change link is invalid or it has expired."
      assert Accounts.get_user_by_email(user.email)
    end

    test "redirects if user is not logged in", %{token: token} do
      conn = build_conn()
      {:error, redirect} = live(conn, ~p"/user/email/confirm/#{token}")
      assert {:redirect, %{to: path, flash: flash}} = redirect
      assert path == ~p"/login"
      assert %{"error" => message} = flash
      assert message == "You must log in to access this page."
    end
  end

  describe "user email back navigation" do
    setup :signup_and_login_user

    test "goes to the previous page", %{conn: conn} do
      {:ok, goals_lv, _html} = live(conn, ~p"/goals")

      assert {:ok, lv, _html} =
               goals_lv
               |> element("a[href='/user/email?redirect_to=%2Fgoals']")
               |> render_click()
               |> follow_redirect(conn, ~p"/user/email?redirect_to=%2Fgoals")

      assert {:ok, back_lv, _html} =
               lv
               |> element("a", "Back")
               |> render_click()
               |> follow_redirect(conn, ~p"/goals")

      assert has_element?(back_lv, "h1", "Goals")
      assert has_element?(back_lv, "li[aria-current='page']", "Goals")
    end

    test "goes to the home page if the previous page isn't set", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/user/email")

      assert {:ok, back_lv, _html} =
               lv
               |> element("a", "Back")
               |> render_click()
               |> follow_redirect(conn, ~p"/")

      assert has_element?(back_lv, "h1", "Summary")
      assert has_element?(back_lv, "li[aria-current='page']", "Summary")
    end
  end
end
