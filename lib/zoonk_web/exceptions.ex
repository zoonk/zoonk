defmodule ZoonkWeb.PermissionError do
  @moduledoc """
  Raises a permission error with a 403 status code.

  ## Examples

      iex> raise ZoonkWeb.PermissionError, code: :require_org_member
      iex> raise ZoonkWeb.PermissionError, message: "Custom error"
      iex> raise ZoonkWeb.PermissionError, code: :require_org_member, data: %{language: "en"}
  """
  use Gettext, backend: Zoonk.Gettext

  defexception [:message, :code, :data, plug_status: 403]

  @impl Exception
  def exception(opts) when is_list(opts) do
    code = Keyword.get(opts, :code)
    data = Keyword.get(opts, :data)
    message = get_message(code)

    %__MODULE__{
      message: message,
      code: code,
      data: data
    }
  end

  def exception(message: message), do: %__MODULE__{message: message}

  defp get_message(:require_org_member), do: dgettext("errors", "You must be a member of the organization")
  defp get_message(_code), do: dgettext("errors", "An error occurred. Please try again later.")
end
