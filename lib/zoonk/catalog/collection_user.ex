defmodule Zoonk.Catalog.CollectionUser do
  @moduledoc """
  Defines the `CollectionUser` schema.

  This schema represents the association between users and collections.
  It tracks which users have access to which collections and their roles.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `collection_id` | `Integer` | The ID of the collection the user has access to. |
  | `user_id` | `Integer` | The ID of the user who has access to the collection. |
  | `role` | `Ecto.Enum` | The role of the user in the collection (editor or member). |
  | `inserted_at` | `DateTime` | Timestamp when the association was created. |
  | `updated_at` | `DateTime` | Timestamp when the association was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Catalog.Collection

  schema "collection_users" do
    field :role, Ecto.Enum, values: [:editor, :member], default: :member

    belongs_to :collection, Collection
    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(collection_user, attrs) do
    collection_user
    |> cast(attrs, [:collection_id, :user_id, :role])
    |> validate_required([:collection_id, :user_id, :role])
    |> unique_constraint([:collection_id, :user_id])
  end
end
