defmodule ZoonkWeb.API.V1.Accounts.AuthController do
  @moduledoc """
  Controller for handling general authentication operations via API.

  This controller provides endpoints for common authentication actions
  like logout that are shared across authentication methods.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Accounts
  alias ZoonkWeb.API.ErrorResponse

  @doc """
  Logs out a user by invalidating their session token.

  ## Request headers

  - `Authorization` - Bearer token for the session to invalidate (required)

  ## Response

  - 204 No Content on successful logout
  - 401 Unauthorized if no valid token is provided
  """
  def logout(conn, _params) when is_nil(conn.assigns.scope.user) do
    ErrorResponse.unauthorized(conn)
  end

  def logout(conn, _params) do
    ["Bearer " <> token] = get_req_header(conn, "authorization")
    Accounts.delete_user_session_token(token)
    send_resp(conn, :no_content, "")
  end
end
