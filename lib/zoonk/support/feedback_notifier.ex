defmodule Zoonk.Support.FeedbackNotifier do
  @moduledoc """
  Handles email notifications for user feedback.

  This module is responsible for sending feedback messages
  from users to the support team.
  """
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Mailer

  @doc """
  Deliver feedback from a user to the support team.

  ## Examples

      iex> deliver_feedback("user@example.com", "Great app!")
      {:ok, %Swoosh.Email{}}

  """
  def deliver_feedback(user_email, message) do
    subject = dgettext("emails", "New feedback from %{email}", email: user_email)

    content =
      dgettext(
        "emails",
        """
        You have received new feedback from a user.

        From: %{user_email}

        Message:
        %{message}
        """,
        user_email: user_email,
        message: message
      )

    Mailer.send_email("hello@zoonk.com", subject, content)
  end
end
