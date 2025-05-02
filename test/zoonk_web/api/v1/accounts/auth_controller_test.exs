defmodule ZoonkWeb.API.V1.Accounts.AuthControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "DELETE /api/v1/auth/logout" do
    test "logs out user successfully with valid token", %{conn: conn} do
      user = user_fixture()
      token = Accounts.generate_user_session_token(user, decoded: false)

      assert Accounts.get_user_by_session_token(token)

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{token}")
        |> delete("/api/v1/auth/logout")

      assert response(conn, 204)
      refute Accounts.get_user_by_session_token(token)
    end

    test "returns 401 error when no token is provided", %{conn: conn} do
      conn = delete(conn, "/api/v1/auth/logout")
      assert_json_error(conn, 401)
    end

    test "returns 401 error when invalid token format is provided", %{conn: conn} do
      conn =
        conn
        |> put_req_header("authorization", "NotBearer token123")
        |> delete(~p"/api/v1/auth/logout")

      assert_json_error(conn, 401)
    end

    test "returns 401 even if token doesn't exist", %{conn: conn} do
      conn =
        conn
        |> put_req_header("authorization", "Bearer non-existent-token")
        |> delete(~p"/api/v1/auth/logout")

      assert_json_error(conn, 401)
    end
  end
end
