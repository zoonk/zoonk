defmodule Zoonk.Orgs.TeamMember do
  @moduledoc """
  Defines the `TeamMember` schema.

  Teams can have multiple members. Keeping track of members
  is important for scoping content and managing access.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `role` | `Ecto.Enum` | Role is used for permission checks. |
  | `org_id` | `Integer` | ID from `Zoonk.Orgs.Org` |
  | `team_id` | `Integer` | ID from `Zoonk.Orgs.Team` |
  | `user_id` | `Integer` | ID from `Zoonk.Accounts.User` |
  | `inserted_at` | `DateTime` | Timestamp when the member was created. |
  | `updated_at` | `DateTime` | Timestamp when the member was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.Team

  schema "team_members" do
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
    |> validate_required([:role, :org_id, :team_id, :user_id])
    |> unique_constraint([:org_id, :team_id, :user_id])
  end
end
