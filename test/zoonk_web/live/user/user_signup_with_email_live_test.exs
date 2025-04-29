defmodule ZoonkWeb.User.SignUpWithEmailLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  describe "Sign up with email page" do
    test "renders signup page", %{conn: conn} do
      conn
      |> visit(~p"/signup/email")
      |> assert_has("button[type=submit]", text: "Create an account")
    end

    test "redirects if already logged in", %{conn: conn} do
      conn
      |> login_user(user_fixture())
      |> visit(~p"/signup/email")
      |> assert_path(~p"/")
    end

    test "renders errors for invalid data", %{conn: conn} do
      conn
      |> visit(~p"/signup/email")
      |> fill_in("Email address", with: "with spaces")
      |> assert_has("p", text: "must have the @ sign and no spaces")
    end
  end

  describe "signs up user (:app org)" do
    setup do
      app_org = app_org_fixture()
      conn = Map.put(build_conn(), :host, app_org.custom_domain)

      %{conn: conn}
    end

    test "use the browser's language", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "pt-BR")

      conn
      |> visit(~p"/signup/email")
      |> assert_has("option[value=pt][selected]")
    end

    test "set the html tag properly", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept-language", "pt-BR")
        |> get(~p"/signup/email")

      assert html_response(conn, 200) =~ ~s'<html lang="pt"'
    end

    test "handles an unsupported locale", %{conn: conn} do
      conn = put_req_header(conn, "accept-language", "hi")

      conn
      |> visit(~p"/signup/email")
      |> assert_has("button", text: "Create an account")
    end

    test "creates account but does not log in", %{conn: conn} do
      email = unique_user_email()

      conn
      |> visit(~p"/signup/email")
      |> fill_in("Email address", with: email)
      |> submit()
      |> assert_path(~p"/signup/code")

      user = Zoonk.Accounts.get_user_by_email(email)
      assert user.confirmed_at == nil
    end

    test "renders errors for duplicated email", %{conn: conn} do
      user = user_fixture(%{email: "test@email.com"})

      conn
      |> visit(~p"/signup/email")
      |> fill_in("Email address", with: user.email)
      |> submit()
      |> assert_has("p", text: "has already been taken")
    end
  end

  describe "signup navigation" do
    test "redirects to login page when the Log in button is clicked", %{conn: conn} do
      conn
      |> visit(~p"/signup/email")
      |> click_link("Login")
      |> assert_path(~p"/login")
      |> assert_has("a", text: "Login with Email")
    end
  end
end
