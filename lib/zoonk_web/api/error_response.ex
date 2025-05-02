defmodule ZoonkWeb.API.ErrorResponse do
  @moduledoc """
  Module for handling error responses in the API.
  """
  import Phoenix.Controller
  import Plug.Conn

  alias Plug.Conn.Status

  @doc """
  Sends a JSON error response with the given status code and message.

  ## Examples
      iex> ErrorResponse.send_error(conn, :bad_request, "Invalid request")
      %Plug.Conn{...}
  """
  def send_error(conn, status, message) do
    conn
    |> put_status(status)
    |> json(%{error: %{code: Status.code(status), message: message}})
  end

  @doc """
  Sends a JSON error response for invalid parameters.

  ## Examples

      iex> ErrorResponse.invalid_params(conn)
      %Plug.Conn{...}
  """
  def invalid_params(conn) do
    send_error(conn, :unprocessable_entity, "Invalid parameters")
  end

  @doc """
  Sends a JSON error response for missing required parameters.

  ## Examples

      iex> ErrorResponse.missing_params(conn)
      %Plug.Conn{...}
  """
  def missing_params(conn) do
    send_error(conn, :bad_request, "Missing required parameters")
  end
end
