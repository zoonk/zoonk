defmodule Zoonk.Accounts.UserNotifier do
  @moduledoc """
  Service for managing user emails.
  """
  import Swoosh.Email
  import ZoonkWeb.Gettext

  alias Zoonk.Mailer

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body) do
    app_name = Application.get_env(:zoonk, :app_name)
    support_email = Application.get_env(:zoonk, :support_email)

    email =
      new()
      |> to(recipient)
      |> from({app_name, support_email})
      |> subject(subject)
      |> text_body(body)

    with {:ok, _metadata} <- Mailer.deliver(email) do
      {:ok, email}
    end
  end

  @doc """
  Deliver instructions to confirm account.
  """
  def deliver_confirmation_instructions(user, url) do
    subject = dgettext("mailer", "Confirmation instructions")

    content =
      dgettext(
        "mailer",
        """
        Hi %{name},

        You can confirm your account by visiting the URL below:

        %{url}

        If you didn't create an account with us, please ignore this.
        """,
        name: user.first_name,
        url: url
      )

    deliver(user.email, subject, content)
  end

  @doc """
  Deliver instructions to reset a user password.
  """
  def deliver_reset_password_instructions(user, url) do
    subject = dgettext("mailer", "Reset password instructions")

    content =
      dgettext(
        "mailer",
        """
        Hi %{name},

        You can reset your password by visiting the URL below:

        %{url}

        If you didn't request this change, please ignore this.
        """,
        name: user.first_name,
        url: url
      )

    deliver(user.email, subject, content)
  end

  @doc """
  Deliver instructions to update a user email.
  """
  def deliver_update_email_instructions(user, url) do
    subject = dgettext("mailer", "Update email instructions")

    content =
      dgettext(
        "mailer",
        """
        Hi %{name},

        You can change your email by visiting the URL below:

        %{url}

        If you didn't request this change, please ignore this.
        """,
        name: user.first_name,
        url: url
      )

    deliver(user.email, subject, content)
  end
end
