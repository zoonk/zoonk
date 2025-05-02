defmodule ZoonkWeb.API.V1.Accounts.OTPController do
  @moduledoc """
  Controller for handling OTP-based authentication operations via API.

  This controller provides endpoints for user signup and authentication
  using one-time passwords sent via email.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User

  @doc """
  Creates a new user account and sends a login OTP code via email.

  ## Request body fields

  - `email` - User's email address (required)
  - `language` - User's preferred language code (required)

  ## Response

  - 204 No Content on success
  - 422 Unprocessable Entity on validation failure with error details
  - 400 Bad Request if required parameters are missing
  """
  def signup(conn, %{"email" => _email, "language" => _language} = user_params) do
    # Manually validate language since it's required but the schema might not enforce it
    case Accounts.signup_user(user_params, conn.assigns.scope) do
      {:ok, user} ->
        deliver_login_instructions(conn, user)

      {:error, _changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: %{code: 422, message: "Invalid parameters"}})
    end
  end

  def signup(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: %{code: 400, message: "Missing required parameters"}})
  end

  defp deliver_login_instructions(conn, %User{} = user) do
    case Accounts.deliver_login_instructions(user) do
      {:ok, _url_fn} ->
        # Return 204 No Content to avoid leaking account existence
        send_resp(conn, :no_content, "")

      {:error, _error} ->
        # try sending again
        deliver_login_instructions(conn, user)
    end
  end
end
