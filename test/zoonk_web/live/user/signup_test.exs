defmodule ZoonkWeb.UserLive.RegistrationTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AuthFixtures

  describe "Registration page" do
    test "renders registration page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/users/signup")

      assert html =~ "Sign Up"
      assert html =~ "Log in"
    end

    test "redirects if already logged in", %{conn: conn} do
      result =
        conn
        |> signin_user(user_fixture())
        |> live(~p"/users/signup")
        |> follow_redirect(conn, ~p"/")

      assert {:ok, _conn} = result
    end

    test "renders errors for invalid data", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/signup")

      result =
        lv
        |> element("#registration_form")
        |> render_change(user: %{"email" => "with spaces"})

      assert result =~ "Sign Up"
      assert result =~ "must have the @ sign and no spaces"
    end
  end

  describe "register user" do
    test "creates account but does not log in", %{conn: conn} do
      {:ok, lv, _html} =
        conn
        |> put_connect_params(%{"timezone" => "Europe/London"})
        |> live(~p"/users/signup")

      email = unique_user_email()
      attrs = [email: email] |> valid_user_attributes() |> Map.delete(:timezone)
      form = form(lv, "#registration_form", user: attrs)

      {:ok, _lv, html} =
        form
        |> render_submit()
        |> follow_redirect(conn, ~p"/users/signin")

      assert html =~
               ~r/An email was sent to .*, please access it to confirm your account/

      user = Zoonk.Auth.get_user_by_email(email)
      assert user.confirmed_at == nil
      assert user.timezone == "Europe/London"
    end

    test "renders errors for duplicated email", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/signup")

      user = user_fixture(%{email: "test@email.com"})

      result =
        lv
        |> form("#registration_form",
          user: %{"email" => user.email}
        )
        |> render_submit()

      assert result =~ "has already been taken"
    end
  end

  describe "registration navigation" do
    test "redirects to signin page when the Log in button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/signup")

      {:ok, _signin_live, signin_html} =
        lv
        |> element(~s|main a:fl-contains("Sign in")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/users/signin")

      assert signin_html =~ "Log in"
    end
  end
end
