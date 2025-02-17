defmodule Zoonk.Auth.UserNotifier do
  @moduledoc """
  Handles email notifications for user authentication events.

  This module is responsible for sending email instructions
  to users for various authentication-related actions,
  such as updating their email, signing in with a magic link,
  or confirming their account.
  """
  use Gettext, backend: ZoonkWeb.Gettext

  alias Zoonk.Configuration
  alias Zoonk.Mailer
  alias ZoonkSchema.User

  @doc """
  Deliver instructions to update a user email.
  """
  def deliver_update_email_instructions(user, url) do
    subject = dgettext("email", "Update email instructions")

    content =
      dgettext(
        "email",
        """
        Hi %{email},

        You can change your email by visiting the URL below:

        %{url}

        This link will expire in %{expiration_days} days.

        If you didn't request this change, please ignore this.
        """,
        email: user.email,
        url: url,
        expiration_days: Zoonk.Configuration.get_change_email_validity_in_days()
      )

    Mailer.send_email(user.email, subject, content)
  end

  @doc """
  Deliver instructions to log in with a magic link.
  """
  def deliver_signin_instructions(user, url) do
    case user do
      %User{confirmed_at: nil} -> deliver_confirmation_instructions(user, url)
      _confirmed -> deliver_magic_link_instructions(user, url)
    end
  end

  defp deliver_magic_link_instructions(user, url) do
    subject = dgettext("email", "Log in instructions")

    content =
      dgettext(
        "email",
        """
        Hi %{email},

        You can log into your account by visiting the URL below:

        %{url}

        This link will expire in %{expiration_minutes} minutes.

        If you didn't request this email, please ignore this.
        """,
        email: user.email,
        url: url,
        expiration_minutes: Configuration.get_magic_link_validity_in_minutes()
      )

    Mailer.send_email(user.email, subject, content)
  end

  defp deliver_confirmation_instructions(user, url) do
    subject = dgettext("email", "Confirmation instructions")

    content =
      dgettext(
        "email",
        """
        Hi %{email},

        You can confirm your account by visiting the URL below:

        %{url}

        This link will expire in %{expiration_minutes} minutes.

        If you didn't create an account with us, please ignore this.
        """,
        email: user.email,
        url: url,
        expiration_minutes: Configuration.get_magic_link_validity_in_minutes()
      )

    Mailer.send_email(user.email, subject, content)
  end
end
