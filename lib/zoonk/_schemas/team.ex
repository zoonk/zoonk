defmodule Zoonk.Schemas.Team do
  @moduledoc """
  Defines the `Team` schema.

  Every organization can have multiple teams.
  Some orgs keep their content restricted to specific teams.

  Creating teams are optional. Some organizations may not
  use teams at all.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `name` | `String` | Team name is visible to members. |
  | `slug` | `String` | Slug used for the team's URL. |
  | `description` | `String` | Description of the team. |
  | `logo_url` | `String` | URL for the team's logo. |
  | `org_id` | `Integer` | ID from `Zoonk.Schemas.Org` |
  | `members` | `Zoonk.Schemas.Member` | List all members associated with this team. |
  | `inserted_at` | `DateTime` | Timestamp when the team was created. |
  | `updated_at` | `DateTime` | Timestamp when the team was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Schemas.Member
  alias Zoonk.Schemas.Org

  schema "teams" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :logo_url, :string

    belongs_to :org, Org
    has_many :members, Member

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(team, attrs) do
    team
    |> cast(attrs, [:name, :slug, :description, :logo_url, :org_id])
    |> validate_required([:name, :slug, :org_id])
    |> validate_length(:name, min: 1, max: 32)
    |> validate_length(:slug, min: 1, max: 32)
    |> unique_constraint([:org_id, :slug])
  end
end
