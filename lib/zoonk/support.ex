defmodule Zoonk.Support do
  @moduledoc """
  The Support context for handling user feedback and support requests.
  """

  alias Zoonk.Support.FeedbackNotifier

  @doc """
  Sends feedback from a user.

  ## Parameters
    - `user_email` (string): The email address of the user sending feedback.
    - `message` (string): The feedback message content.

  ## Returns
    - `{:ok, :sent}` if the feedback was successfully sent.
    - `{:error, changeset}` if there are validation errors.

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
  Returns a changeset for tracking feedback changes.

  ## Examples

      iex> change_feedback(%{email: "user@example.com", message: "Hello"})
      %Ecto.Changeset{}

  """
  def change_feedback(attrs \\ %{}) do
    validate_feedback(attrs)
  end

  defp validate_feedback(attrs) do
    types = %{email: :string, message: :string}

    {%{}, types}
    |> Ecto.Changeset.cast(attrs, [:email, :message])
    |> Ecto.Changeset.validate_required([:email, :message])
    |> Ecto.Changeset.validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/)
    |> Ecto.Changeset.validate_length(:message, min: 10)
  end
end
