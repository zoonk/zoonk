defmodule ZoonkWeb.UserRegistrationLiveTest do
  @moduledoc false
  use ZoonkWeb.ConnCase

  import Phoenix.LiveViewTest
  import Zoonk.AccountsFixtures

  describe "Registration page" do
    test "renders registration page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/users/register")

      assert html =~ "Register"
      assert html =~ "Log in"
    end

    test "redirects if already logged in", %{conn: conn} do
      result =
        conn
        |> log_in_user(user_fixture())
        |> live(~p"/users/register")
        |> follow_redirect(conn, "/")

      assert {:ok, _conn} = result
    end

    test "renders errors for invalid data", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/register")

      result =
        lv
        |> element("#registration_form")
        |> render_change(
          user: %{"email" => "with spaces", "date_of_birth" => "89-24-12", "password" => "short"}
        )

      assert result =~ "Register"
      assert result =~ "is invalid"
      assert result =~ "at least one digit or punctuation character"
      assert result =~ "at least one upper case character"
      assert result =~ "must have the @ sign and no spaces"
      assert result =~ "should be at least 8 character"
    end
  end

  describe "register user" do
    test "creates account and logs the user in", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/register")

      email = unique_user_email()
      username = unique_user_username()
      user = valid_user_attributes(email: email, username: username)

      form = form(lv, "#registration_form", user: user)

      render_submit(form)
      conn = follow_trigger_action(form, conn)

      assert redirected_to(conn) == ~p"/"

      # Now do a logged in request and assert on the menu
      conn = get(conn, "/")
      response = html_response(conn, 200)
      assert response =~ email
      assert response =~ user.first_name
      assert response =~ user.last_name
      assert response =~ username
      assert response =~ "Settings"
      assert response =~ "Log out"
    end

    test "renders errors for duplicated email", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/register")

      user = user_fixture(%{email: "test@email.com"})

      result =
        lv
        |> form("#registration_form",
          user: %{"email" => user.email, "password" => "ValidPassword1"}
        )
        |> render_submit()

      assert result =~ "has already been taken"
    end

    test "renders errors for duplicated username", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/register")

      user = user_fixture(%{username: "duplicated_username"})

      result =
        lv
        |> form("#registration_form", user: %{"username" => user.username})
        |> render_submit()

      assert result =~ "has already been taken"
    end

    test "use the browser's language as the default value", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "pt-BR")

      {:ok, lv, html} = live(conn, ~p"/users/register")

      option = element(lv, ~s|option[value="pt"]|)

      assert render(option) =~ "selected"
      assert html =~ "Criar uma nova conta"
      assert html =~ ~s'<html lang="pt">'
    end

    test "does not have access if user is younger than 13 years old", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/register")

      date_of_birth = Date.utc_today() |> Date.add(-365 * 12)
      user = valid_user_attributes(date_of_birth: date_of_birth)

      form = form(lv, "#registration_form", user: user)
      render_submit(form)
      conn = follow_trigger_action(form, conn)

      assert redirected_to(conn) == ~p"/"
      conn = get(conn, "/")

      assert redirected_to(conn) == ~p"/age-restriction"
      conn = get(conn, "/age-restriction")
      response = html_response(conn, 200)

      assert response =~ "You need to be, at least, 13 years old to use Zoonk."
    end
  end

  describe "registration navigation" do
    test "redirects to login page when the Log in button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/register")

      {:ok, _login_live, login_html} =
        lv
        |> element(~s|main a:fl-contains("Sign in")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/users/log_in")

      assert login_html =~ "Log in"
    end
  end
end
