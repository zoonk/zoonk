defmodule Zoonk.Schemas.Member do
  @moduledoc """
  Defines the `Member` schema.

  Organizations and teams can have multiple members.
  Keeping track of members is important for
  scoping content and managing access.

  Some members may belong to an organization but not to a team.
  In this case, the `team_id` field will be `nil`.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `role` | `Ecto.Enum` | Role is used for permission checks. |
  | `org_id` | `Integer` | ID from `Zoonk.Schemas.Org` |
  | `team_id` | `Integer` | ID from `Zoonk.Schemas.Team` |
  | `user_id` | `Integer` | ID from `Zoonk.Schemas.User` |
  | `inserted_at` | `DateTime` | Timestamp when the member was created. |
  | `updated_at` | `DateTime` | Timestamp when the member was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Schemas.Org
  alias Zoonk.Schemas.Team
  alias Zoonk.Schemas.User

  schema "members" do
    field :role, Ecto.Enum, values: [:admin, :member], default: :member

    belongs_to :org, Org
    belongs_to :team, Team
    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(member, attrs) do
    member
    |> cast(attrs, [:role, :org_id, :team_id, :user_id])
    |> validate_required([:role, :org_id, :user_id])
    |> unique_constraint([:org_id, :team_id, :user_id])
  end
end
