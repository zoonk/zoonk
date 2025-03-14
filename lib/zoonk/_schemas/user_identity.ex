defmodule Zoonk.Schemas.UserIdentity do
  @moduledoc """
  Defines the `UserIdentity` schema.

  Users can have multiple identities, such as email or
  third-party OAuth accounts.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `identity` | `Ecto.Enum` | Identity used for authentication. |
  | `identity_id` | `String` | UID used by third-party accounts or the user's email address. |
  | `user_id` | `Integer` | The ID from `Zoonk.Schemas.User`. |
  | `inserted_at` | `DateTime` | Timestamp when the identity data was created. |
  | `updated_at` | `DateTime` | Timestamp when the identity data was last updated. |
  """
  use Ecto.Schema
  use Gettext, backend: Zoonk.Gettext

  import Ecto.Changeset

  alias Zoonk.Configuration

  schema "user_identities" do
    field :identity, Ecto.Enum, values: Configuration.list_user_identities()
    field :identity_id, :string
    field :is_primary, :boolean, default: false

    belongs_to :user, Zoonk.Schemas.User

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user identity changeset for adding or updating a user's identity data.
  """
  def changeset(user_identity, attrs) do
    user_identity
    |> cast(attrs, [:identity, :identity_id, :is_primary, :user_id])
    |> validate_required([:identity, :identity_id, :is_primary, :user_id])
    |> validate_length(:identity_id, min: 6, max: 160)
    |> validate_id()
    |> unsafe_validate_unique([:identity, :identity_id], Zoonk.Repo)
    |> unique_constraint([:identity, :identity_id])
  end

  # `:email` identities must be a valid email address.
  # while external accounts must NOT be an email address.
  defp validate_id(changeset), do: validate_id(changeset, get_field(changeset, :identity))

  defp validate_id(changeset, :email) do
    validate_format(changeset, :identity_id, ~r/^[^@,;\s]+@[^@,;\s]+$/,
      message: dgettext("errors", "must have the @ sign and no spaces")
    )
  end

  defp validate_id(changeset, _identity) do
    validate_format(changeset, :identity_id, ~r/^[^@]+$/, message: dgettext("errors", "must NOT be an email address"))
  end
end
