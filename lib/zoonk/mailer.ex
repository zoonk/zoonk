defmodule Zoonk.Mailer do
  @moduledoc """
  Handles email delivery for Zoonk using Swoosh.

  This module is responsible for sending transactional emails,
  such as account notifications and updates.
  """
  use Swoosh.Mailer, otp_app: :zoonk

  import Swoosh.Email

  @doc """
  Sends an email with the given recipient, subject, and body.

  ## Parameters
    - `recipient` (string): The email address of the recipient.
    - `subject` (string): The subject of the email.
    - `body` (string): The plain text content of the email.

  ## Returns
    - `{:ok, email}` if the email was successfully sent.
    - An error tuple if the email delivery fails.
  """
  def send_email(recipient, subject, body) do
    email =
      new()
      |> to(recipient)
      |> from({"Zoonk", "hello@zoonk.org"})
      |> subject(subject)
      |> text_body(body)

    with {:ok, _metadata} <- __MODULE__.deliver(email) do
      {:ok, email}
    end
  end
end
