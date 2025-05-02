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
      conn = post(conn, ~p"/api/v1/auth/otp/signup", user_params)
      assert response(conn, 204) == ""

      assert Accounts.get_user_by_email(email)
      assert_email_sent(to: email)
    end

    test "returns error when email format is invalid", %{conn: conn} do
      email = "invalid_email"
      user_params = %{"email" => email, "language" => "en"}
      conn = post(conn, ~p"/api/v1/auth/otp/signup", user_params)
      assert %{"error" => %{"code" => 422, "message" => "Invalid parameters"}} = json_response(conn, 422)
      refute Accounts.get_user_by_email(email)
    end

    test "returns error when email is missing", %{conn: conn} do
      user_params = %{"language" => "en"}
      conn = post(conn, ~p"/api/v1/auth/otp/signup", user_params)
      assert %{"error" => %{"code" => 400, "message" => "Missing required parameters"}} = json_response(conn, 400)
    end

    test "returns error when language is missing", %{conn: conn} do
      email = unique_user_email()
      user_params = %{"email" => email}
      conn = post(conn, ~p"/api/v1/auth/otp/signup", user_params)
      assert %{"error" => %{"code" => 400, "message" => "Missing required parameters"}} = json_response(conn, 400)
      refute Accounts.get_user_by_email(email)
    end
  end
end
