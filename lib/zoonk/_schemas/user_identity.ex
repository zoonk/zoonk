defmodule Zoonk.Schemas.UserIdentity do
  @moduledoc """
  Defines the `UserIdentity` schema.

  Users can have multiple identities, such as email or
  third-party OAuth accounts.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `identity` | `Ecto.Enum` | Identity used for authentication. |
  | `identity_uid` | `String` | UID used by third-party accounts. |
  | `user_id` | `Integer` | The ID from `Zoonk.Schemas.User`. |
  | `inserted_at` | `DateTime` | Timestamp when the identity data was created. |
  | `updated_at` | `DateTime` | Timestamp when the identity data was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Configuration

  schema "user_identities" do
    field :identity, Ecto.Enum, values: Configuration.list_user_identities()
    field :identity_uid, :string

    belongs_to :user, Zoonk.Schemas.User

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user identity changeset for adding or updating a user's identity data.
  """
  def changeset(user_identity, attrs) do
    user_identity
    |> cast(attrs, [:identity, :identity_uid, :user_id])
    |> validate_required([:identity, :identity_uid, :user_id])
    |> unique_constraint([:user_id, :identity])
  end
end
