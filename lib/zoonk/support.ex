defmodule Zoonk.Support do
  @moduledoc """
  The Support context for handling user feedback and support requests.
  """

  alias Zoonk.Support.FeedbackNotifier
  alias Zoonk.Support.SupportNotifier

  @doc """
  Sends feedback from a user.

  ## Examples

      iex> send_feedback("user@example.com", "Great app!")
      {:ok, :sent}

      iex> send_feedback("", "")
      {:error, %Ecto.Changeset{}}

  """
  def send_feedback(user_email, message) do
    changeset = validate_feedback(%{email: user_email, message: message})

    if changeset.valid? do
      FeedbackNotifier.deliver_feedback(user_email, message)
      {:ok, :sent}
    else
      {:error, changeset}
    end
  end

  @doc """
  Sends a support request from a user.

  ## Examples

      iex> send_support_request("user@example.com", "I need help with login")
      {:ok, :sent}

      iex> send_support_request("", "")
      {:error, %Ecto.Changeset{}}

  """
  def send_support_request(user_email, message) do
    changeset = validate_support_request(%{email: user_email, message: message})

    if changeset.valid? do
      SupportNotifier.deliver_support_request(user_email, message)
      {:ok, :sent}
    else
      {:error, changeset}
    end
  end

  @doc """
  Returns a changeset for tracking feedback changes.

  ## Examples

      iex> change_feedback(%{email: "user@example.com", message: "Hello"})
      %Ecto.Changeset{}

  """
  def change_feedback(attrs \\ %{}) do
    validate_feedback(attrs)
  end

  @doc """
  Returns a changeset for tracking support request changes.

  ## Examples

      iex> change_support_request(%{email: "user@example.com", message: "I need help"})
      %Ecto.Changeset{}

  """
  def change_support_request(attrs \\ %{}) do
    validate_support_request(attrs)
  end

  defp validate_feedback(attrs) do
    types = %{email: :string, message: :string}

    {%{}, types}
    |> Ecto.Changeset.cast(attrs, [:email, :message])
    |> Ecto.Changeset.validate_required([:email, :message])
    |> Ecto.Changeset.validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/)
    |> Ecto.Changeset.validate_length(:message, min: 10)
  end

  defp validate_support_request(attrs) do
    types = %{email: :string, message: :string}

    {%{}, types}
    |> Ecto.Changeset.cast(attrs, [:email, :message])
    |> Ecto.Changeset.validate_required([:email, :message])
    |> Ecto.Changeset.validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/)
    |> Ecto.Changeset.validate_length(:message, min: 15)
  end
end
