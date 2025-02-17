defmodule ZoonkSchema.UserToken do
  @moduledoc """
  Represents authentication and verification tokens for users.

  We send tokens to users when they try to sign in or sign up
  using a magic link, or when they change their email address.

  ## Fields

    * `token` - A unique binary token used for authentication or verification.
    * `context` - A string defining the token's purpose (e.g., "session").
    * `sent_to` - The email address to which the token was sent.
    * `user_id` - References the associated user.
  """
  use Ecto.Schema

  schema "users_tokens" do
    field :token, :binary
    field :context, :string
    field :sent_to, :string
    belongs_to :user, ZoonkSchema.User

    timestamps(type: :utc_datetime, updated_at: false)
  end
end
