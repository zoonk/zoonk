defmodule ZoonkWeb.API.V1.Accounts.OTPControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Swoosh.TestAssertions
  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "signup/2" do
    setup :setup_app

    test "creates a user and delivers login instructions when data is valid", %{conn: conn} do
      email = unique_user_email()
      user_params = %{"email" => email, "language" => "pt"}
      conn = post(conn, ~p"/api/v1/auth/signup", user_params)
      assert response(conn, 204) == ""

      assert Accounts.get_user_by_email(email)
      assert_email_sent(to: email)
    end

    test "returns error when email format is invalid", %{conn: conn} do
      email = "invalid_email"
      user_params = %{"email" => email, "language" => "en"}
      conn = post(conn, ~p"/api/v1/auth/signup", user_params)
      assert_json_error(conn, 422)
      refute Accounts.get_user_by_email(email)
    end

    test "returns error when email is missing", %{conn: conn} do
      user_params = %{"language" => "en"}
      conn = post(conn, ~p"/api/v1/auth/signup", user_params)
      assert_json_error(conn, 400)
    end

    test "returns error when language is missing", %{conn: conn} do
      email = unique_user_email()
      user_params = %{"email" => email}
      conn = post(conn, ~p"/api/v1/auth/signup", user_params)
      assert_json_error(conn, 400)
      refute Accounts.get_user_by_email(email)
    end
  end

  describe "request_code/2" do
    setup :setup_app

    test "delivers login instructions when email exists", %{conn: conn} do
      email = user_fixture().email
      conn = post(conn, ~p"/api/v1/auth/request_code", %{"email" => email})
      assert response(conn, 204) == ""
      assert_email_sent(to: email)
    end

    test "returns success even when email doesn't exist to prevent email enumeration", %{conn: conn} do
      email = unique_user_email()
      conn = post(conn, ~p"/api/v1/auth/request_code", %{"email" => email})
      assert response(conn, 204) == ""
      refute_email_sent()
    end

    test "returns error when email is missing", %{conn: conn} do
      conn = post(conn, ~p"/api/v1/auth/request_code", %{})
      assert_json_error(conn, 400)
    end
  end

  describe "verify_code/2" do
    setup :setup_app

    test "returns a session token when the code is valid", %{conn: conn} do
      user = user_fixture()
      otp_code = extract_otp_code(Accounts.deliver_login_instructions(user))

      conn = post(conn, ~p"/api/v1/auth/verify_code", %{"code" => otp_code})

      assert %{"token" => token} = json_response(conn, 200)
      assert {:ok, _decoded} = Base.decode64(token)
    end

    test "returns error when the code is invalid", %{conn: conn} do
      invalid_code = "invalid_code"
      conn = post(conn, ~p"/api/v1/auth/verify_code", %{"code" => invalid_code})

      assert %{"error" => %{"message" => "Invalid code or expired"}} = json_response(conn, 401)
    end

    test "returns error when code is missing", %{conn: conn} do
      conn = post(conn, ~p"/api/v1/auth/verify_code", %{})
      assert_json_error(conn, 400)
    end
  end
end
