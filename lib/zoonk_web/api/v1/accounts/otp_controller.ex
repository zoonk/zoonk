defmodule ZoonkWeb.API.V1.Accounts.OTPController do
  @moduledoc """
  Controller for handling OTP-based authentication operations via API.

  This controller provides endpoints for user signup, authentication,
  and requesting one-time passwords sent via email.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias ZoonkWeb.API.ErrorResponse

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
        ErrorResponse.invalid_params(conn)
    end
  end

  def signup(conn, _params) do
    ErrorResponse.missing_params(conn)
  end

  @doc """
  Sends a login OTP code via email to an existing user.

  ## Request body fields

  - `email` - User's email address (required)

  ## Response

  - 204 No Content on success (this response is returned even if the email doesn't exist to prevent email enumeration)
  - 400 Bad Request if required parameters are missing
  """
  def request_code(conn, %{"email" => email}) do
    if user = Accounts.get_user_by_email(email) do
      deliver_login_instructions(conn, user)
    else
      # Return 204 even if user doesn't exist to prevent email enumeration
      send_resp(conn, :no_content, "")
    end
  end

  def request_code(conn, _params) do
    ErrorResponse.missing_params(conn)
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
