defmodule ZoonkWeb.UserLive.SignUpWithEmailTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.AccountFixtures

  alias Zoonk.Accounts
  alias Zoonk.Repo
  alias Zoonk.Schemas.User

  describe "Sign up with email page" do
    test "renders signup page", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")
      assert has_element?(lv, "button[type=submit]", "Create an account")
    end

    test "redirects if already logged in", %{conn: conn} do
      result =
        conn
        |> login_user(user_fixture().user_identity)
        |> live(~p"/signup/email")
        |> follow_redirect(conn, ~p"/")

      assert {:ok, _conn} = result
    end

    test "renders errors for invalid data", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      result =
        lv
        |> element("#signup_form")
        |> render_change(user: %{"identity_id" => "with spaces"})

      assert result =~ "Create an account"
      assert result =~ "must have the @ sign and no spaces"
    end
  end

  describe "signs up user" do
    test "use the browser's language", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "pt-BR")

      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      email = unique_user_email()
      form = form(lv, "#signup_form", user: %{"identity_id" => email})

      {:ok, _lv, _html} =
        form
        |> render_submit()
        |> follow_redirect(conn, ~p"/login/email")

      user_identity = Accounts.get_user_identity_by_email(email)
      assert Repo.get!(User, user_identity.user_id).language == :pt
    end

    test "handles an unsupported locale", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "hi")

      assert {:ok, lv, _html} = live(conn, ~p"/signup/email")

      email = unique_user_email()
      form = form(lv, "#signup_form", user: %{"identity_id" => email})

      {:ok, _lv, _html} =
        form
        |> render_submit()
        |> follow_redirect(conn, ~p"/login/email")

      user_identity = Accounts.get_user_identity_by_email(email)
      assert Repo.get!(User, user_identity.user_id).language == :en
    end

    test "creates account but does not log in", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      email = unique_user_email()
      form = form(lv, "#signup_form", user: %{"identity_id" => email})

      {:ok, _lv, html} =
        form
        |> render_submit()
        |> follow_redirect(conn, ~p"/login/email")

      assert html =~
               ~r/An email was sent to .*, please access it to confirm your account/

      user_identity = Zoonk.Accounts.get_user_identity_by_email(email)
      assert is_nil(user_identity.confirmed_at)
    end

    test "renders errors for duplicated email", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      %{user_identity: user_identity} = user_fixture(%{"identity_id" => "test@email.com"})

      result =
        lv
        |> form("#signup_form", user: %{"identity_id" => user_identity.identity_id})
        |> render_submit()

      assert result =~ "has already been taken"
    end
  end

  describe "signup navigation" do
    test "redirects to login page when the Log in button is clicked", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/signup/email")

      {:ok, _login_live, login_html} =
        lv
        |> element(~s|a:fl-contains("Login")|)
        |> render_click()
        |> follow_redirect(conn, ~p"/login")

      assert login_html =~ "login"
    end
  end
end
