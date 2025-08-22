defmodule Zoonk.Support.SupportNotifier do
  @moduledoc """
  Handles email notifications for user support requests.

  This module is responsible for sending support requests
  from users to the support team.
  """
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Mailer
  alias Zoonk.Support

  @doc """
  Deliver a support request from a user to the support team.

  ## Examples

      iex> deliver_support_request("user@example.com", "I need help with login")
      {:ok, %Swoosh.Email{}}

  """
  def deliver_support_request(user_email, message) do
    subject = dgettext("emails", "Support request", email: user_email)

    content =
      dgettext(
        "emails",
        """
        You have received a new message from a user.

        From: %{user_email}

        Message:
        %{message}
        """,
        user_email: user_email,
        message: message
      )

    Mailer.send_email(Support.support_email(), subject, content)
  end
end
