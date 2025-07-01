defmodule Zoonk.Accounts.UserProvider do
  @moduledoc """
  Defines the `UserProvider` schema.

  We support multiple OAuth providers. Use can sign in with
  any of them and we store the provider data in this table.

  ## Fields

  | Field Name     | Type        | Description                                         |
  | -------------- | ----------- | --------------------------------------------------- |
  | `provider`     | `Ecto.Enum` | The OAuth provider used for authentication.         |
  | `provider_uid` | `String`    | The unique identifier for the user in the provider. |
  | `user_id`      | `Integer`   | The ID from `Zoonk.Accounts.User`.                  |
  | `inserted_at`  | `DateTime`  | Timestamp when the provider data was created.       |
  | `updated_at`   | `DateTime`  | Timestamp when the provider data was last updated.  |
  """
  use Ecto.Schema

  import Ecto.Changeset

  @providers Application.compile_env(:zoonk, :oauth_providers, [])

  schema "user_providers" do
    field :provider, Ecto.Enum, values: @providers
    field :provider_uid, :string

    belongs_to :user, Zoonk.Accounts.User

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(user_provider, attrs) do
    user_provider
    |> cast(attrs, [:provider, :provider_uid, :user_id])
    |> validate_required([:provider, :provider_uid, :user_id])
    |> unique_constraint([:user_id, :provider])
  end
end
