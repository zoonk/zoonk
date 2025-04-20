defmodule Zoonk.Catalog.SpecializationUser do
  @moduledoc """
  Defines the `SpecializationUser` schema.

  This schema represents the association between users and specialization.
  It tracks which users have access to which specializations and their roles.

  ## Fields

  | Field Name         | Type        | Description                                               |
  |--------------------|-------------|-----------------------------------------------------------|
  | `org_id`           | Integer     | The ID of the organization this data belongs to.          |
  | `specialization_id`| Integer     | The ID of the specialization the user has access to.      |
  | `user_id`          | Integer     | The ID of the user who has access to the specialization.  |
  | `role`             | Ecto.Enum   | The role of the user in the specialization.               |
  | `inserted_at`      | DateTime    | Timestamp when the association was created.               |
  | `updated_at`       | DateTime    | Timestamp when the association was last updated.          |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Catalog.Specialization
  alias Zoonk.Orgs.Org

  schema "specialization_users" do
    field :role, Ecto.Enum, values: [:editor, :member], default: :member

    belongs_to :org, Org
    belongs_to :specialization, Specialization
    belongs_to :user, User

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(specialization_user, attrs) do
    specialization_user
    |> cast(attrs, [:org_id, :specialization_id, :user_id, :role])
    |> validate_required([:org_id, :specialization_id, :user_id, :role])
    |> unique_constraint([:org_id, :specialization_id, :user_id])
  end
end
