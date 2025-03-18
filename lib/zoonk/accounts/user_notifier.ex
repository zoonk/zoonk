defmodule Zoonk.Accounts.UserNotifier do
  @moduledoc """
  Handles email notifications for user authentication events.

  This module is responsible for sending email instructions
  to users for various authentication-related actions,
  such as updating their email, logging in with a magic link,
  or confirming their account.
  """
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Accounts.User
  alias Zoonk.Configuration
  alias Zoonk.Mailer

  @doc """
  Deliver instructions to update a user email.
  """
  def deliver_update_email_instructions(user, url) do
    subject = dgettext("emails", "Update email instructions")

    content =
      dgettext(
        "emails",
        """
        Hi %{email},

        You can change your email by visiting the URL below:

        %{url}

        This link will expire in %{expiration_days} days.

        If you didn't request this change, please ignore this.
        """,
        email: user.email,
        url: url,
        expiration_days: Zoonk.Configuration.get_max_age(:change_email, :days)
      )

    Mailer.send_email(user.email, subject, content)
  end

  @doc """
  Deliver instructions to log in with a magic link.
  """
  def deliver_login_instructions(user, url) do
    case user do
      %User{confirmed_at: nil} -> deliver_confirmation_instructions(user, url)
      _confirmed -> deliver_magic_link_instructions(user, url)
    end
  end

  defp deliver_magic_link_instructions(user, url) do
    subject = dgettext("emails", "Log in instructions")

    content =
      dgettext(
        "emails",
        """
        Hi %{email},

        You can log into your account by visiting the URL below:

        %{url}

        This link will expire in %{expiration_minutes} minutes.

        If you didn't request this email, please ignore this.
        """,
        email: user.email,
        url: url,
        expiration_minutes: Configuration.get_max_age(:magic_link, :minutes)
      )

    Mailer.send_email(user.email, subject, content)
  end

  defp deliver_confirmation_instructions(user, url) do
    subject = dgettext("emails", "Confirmation instructions")

    content =
      dgettext(
        "emails",
        """
        Hi %{email},

        You can confirm your account by visiting the URL below:

        %{url}

        This link will expire in %{expiration_minutes} minutes.

        If you didn't create an account with us, please ignore this.
        """,
        email: user.email,
        url: url,
        expiration_minutes: Configuration.get_max_age(:magic_link, :minutes)
      )

    Mailer.send_email(user.email, subject, content)
  end
end
