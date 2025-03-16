defmodule Zoonk.Schemas.UserIdentity do
  @moduledoc """
  Defines the `UserIdentity` schema.

  Users can have multiple identities, such as email or
  third-party OAuth accounts.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `provider` | `Ecto.Enum` | Identity provider used for authentication. |
  | `identity_id` | `String` | UID used by third-party accounts or the user's email address. |
  | `is_primary` | `Boolean` | Indicates if this is the primary identity. |
  | `confirmed_at` | `DateTime` | Timestamp when the identity was confirmed. |
  | `authenticated_at` | `DateTime` | Timestamp when the identity was authenticated. |
  | `user_id` | `Integer` | The ID from `Zoonk.Schemas.User`. |
  | `inserted_at` | `DateTime` | Timestamp when the identity data was created. |
  | `updated_at` | `DateTime` | Timestamp when the identity data was last updated. |
  """
  use Ecto.Schema
  use Gettext, backend: Zoonk.Gettext

  import Ecto.Changeset

  alias Zoonk.Configuration

  schema "user_identities" do
    field :provider, Ecto.Enum, values: Configuration.list_user_identity_providers()
    field :identity_id, :string
    field :is_primary, :boolean, default: false

    field :confirmed_at, :utc_datetime
    field :authenticated_at, :utc_datetime, virtual: true

    belongs_to :user, Zoonk.Schemas.User

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user identity changeset for adding or updating a user's identity data.
  """
  def changeset(user_identity, attrs) do
    user_identity
    |> cast(attrs, [:provider, :identity_id, :is_primary, :user_id])
    |> validate_required([:provider, :identity_id, :is_primary, :user_id])
    |> validate_length(:identity_id, min: 6, max: 160)
    |> validate_primary()
    |> validate_id()
    |> unsafe_validate_unique([:provider, :identity_id], Zoonk.Repo)
    |> unique_constraint([:provider, :identity_id])
  end

  # `:email` identities must be a valid email address.
  # while external accounts must NOT be an email address.
  defp validate_id(changeset), do: validate_id(changeset, get_field(changeset, :provider))

  defp validate_id(changeset, :email) do
    validate_format(changeset, :identity_id, ~r/^[^@,;\s]+@[^@,;\s]+$/,
      message: dgettext("errors", "must have the @ sign and no spaces")
    )
  end

  defp validate_id(changeset, _provider) do
    validate_format(changeset, :identity_id, ~r/^[^@]+$/, message: dgettext("errors", "must NOT be an email address"))
  end

  # Only `email` identities can be primary.
  defp validate_primary(changeset), do: validate_primary(changeset, valid_primary?(changeset))
  defp validate_primary(changeset, true), do: changeset

  defp validate_primary(changeset, false),
    do: add_error(changeset, :is_primary, dgettext("errors", "only email identities can be primary"))

  defp primary?(changeset), do: get_field(changeset, :is_primary) == true
  defp email?(changeset), do: get_field(changeset, :provider) == :email
  defp valid_primary?(changeset), do: email?(changeset) or not primary?(changeset)

  @doc """
  Confirms the account by setting `confirmed_at`.
  """
  def confirm_changeset(identity) do
    now = DateTime.utc_now(:second)
    change(identity, confirmed_at: now)
  end
end
