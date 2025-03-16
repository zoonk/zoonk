defmodule Zoonk.Schemas.UserToken do
  @moduledoc """
  Represents authentication and verification tokens for users.

  We send tokens to users when they try to sign in or sign up
  using a magic link, or when they change their email address.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------
  | `token` | `Binary` | The token used for authentication or verification. |
  | `context` | `String` | The context in which the token is used (e.g., "email_verification"). |
  | `sent_to` | `String` | The email address or phone number to which the token was sent. |
  | `user_identity_id` | `Integer` | The ID from `Zoonk.Schemas.UserIdentity`. |
  | `inserted_at` | `DateTime` | Timestamp when the token was created. |
  | `updated_at` | `DateTime` | Timestamp when the token was last updated. |
  """
  use Ecto.Schema

  schema "users_tokens" do
    field :token, :binary
    field :context, :string
    field :sent_to, :string

    belongs_to :user_identity, Zoonk.Schemas.UserIdentity

    timestamps(type: :utc_datetime, updated_at: false)
  end
end
