defmodule Zoonk.Accounts.UserNotifier do
  @moduledoc """
  Handles email notifications for user authentication events.

  This module is responsible for sending email instructions
  to users for various authentication-related actions,
  such as updating their email, logging in with an OTP code,
  or confirming their account.
  """
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Accounts.User
  alias Zoonk.Mailer

  @change_email_max_age_days Application.compile_env!(:zoonk, :user_token)[:max_age_days][:change_email]
  @otp_max_age_minutes Application.compile_env!(:zoonk, :user_token)[:max_age_minutes][:otp]

  @doc """
  Deliver instructions to update a user email.
  """
  def deliver_update_email_instructions(user, otp_code) do
    subject = dgettext("emails", "Update email instructions")

    content =
      dgettext(
        "emails",
        """
        You can confirm your email address using the code below:

        %{otp_code}

        This code will expire in %{expiration_days} days.

        If you didn't request this change, please ignore this.
        """,
        otp_code: otp_code,
        expiration_days: @change_email_max_age_days
      )

    Mailer.send_email(user.email, subject, content)
  end

  @doc """
  Deliver instructions to log in with an OTP code.
  """
  def deliver_login_instructions(user, otp_code) do
    case user do
      %User{confirmed_at: nil} -> deliver_confirmation_instructions(user, otp_code)
      _confirmed -> deliver_otp_instructions(user, otp_code)
    end
  end

  defp deliver_otp_instructions(user, otp_code) do
    subject = dgettext("emails", "Login instructions")

    content =
      dgettext(
        "emails",
        """
        You can log into your account by using the code below:

        %{otp_code}

        This code will expire in %{expiration_minutes} minutes.

        If you didn't request this email, please ignore this.
        """,
        otp_code: otp_code,
        expiration_minutes: @otp_max_age_minutes
      )

    Mailer.send_email(user.email, subject, content)
  end

  defp deliver_confirmation_instructions(user, otp_code) do
    subject = dgettext("emails", "Confirmation instructions")

    content =
      dgettext(
        "emails",
        """
        You can confirm your account by using the code below:

        %{otp_code}

        This code will expire in %{expiration_minutes} minutes.

        If you didn't create an account with us, please ignore this.
        """,
        otp_code: otp_code,
        expiration_minutes: @otp_max_age_minutes
      )

    Mailer.send_email(user.email, subject, content)
  end
end
