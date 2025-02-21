defmodule Zoonk.Schemas.UserProvider do
  @moduledoc """
  Defines the `UserProvider` schema and related changesets.

  We support multiple OAuth providers. Use can sign in with
  any of them and we store the provider data in this table.

  ## Fields

    * `provider` - The OAuth provider (e.g., :apple, :github, :google, :microsoft).
    * `provider_uid` - The unique identifier for the user from the provider.

  ## Associations

    * `user` - The associated `Zoonk.Schemas.User`.

  ## Changesets
    * `changeset/2` - Validates and updates the user provider data.
  """
  use Ecto.Schema

  import Ecto.Changeset

  schema "user_providers" do
    field :provider, Ecto.Enum, values: [:apple, :github, :google, :microsoft]
    field :provider_uid, :string

    belongs_to :user, Zoonk.Schemas.User

    timestamps(type: :utc_datetime)
  end

  @doc """
  A user provider changeset for adding or updating a user's provider data.
  """
  def changeset(user_provider, attrs) do
    user_provider
    |> cast(attrs, [:provider, :provider_uid, :user_id])
    |> validate_required([:provider, :provider_uid, :user_id])
    |> unique_constraint([:user_id, :provider])
  end
end
