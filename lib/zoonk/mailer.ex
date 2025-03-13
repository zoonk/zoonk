defmodule Zoonk.Mailer do
  @moduledoc """
  Provides email sending functionality.

  You can use `Zoonk.Mailer.send_email/3` to send emails,
  such as account veritification, notifications, and more.
  """
  use Swoosh.Mailer, otp_app: :zoonk

  alias Swoosh.Email

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
      Email.new()
      |> Email.to(recipient)
      |> Email.from({"Zoonk", "hello@zoonk.com"})
      |> Email.subject(subject)
      |> Email.text_body(body)

    with {:ok, _metadata} <- __MODULE__.deliver(email) do
      {:ok, email}
    end
  end
end
