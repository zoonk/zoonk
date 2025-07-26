defmodule Zoonk.Orgs.Team do
  @moduledoc """
  Defines the `Team` schema.

  Every organization can have multiple teams.
  Some orgs keep their content restricted to specific teams.

  Schools can use teams to group students into classes.

  Creating teams is optional. Some organizations may not
  use teams at all.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `name` | `String` | Team name is visible to members. |
  | `slug` | `String` | Slug used for the team's URL. |
  | `description` | `String` | Description of the team. |
  | `logo_url` | `String` | URL for the team's logo. |
  | `org_id` | `Integer` | ID from `Zoonk.Orgs.Org` |
  | `members` | `Zoonk.Orgs.TeamMember` | List all members associated with this team. |
  | `inserted_at` | `DateTime` | Timestamp when the team was created. |
  | `updated_at` | `DateTime` | Timestamp when the team was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.TeamMember

  schema "teams" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :logo_url, :string

    belongs_to :org, Org
    has_many :members, TeamMember

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(team, attrs) do
    team
    |> cast(attrs, [:name, :slug, :description, :logo_url])
    |> validate_required([:name, :slug])
    |> validate_length(:name, min: 1, max: 32)
    |> validate_length(:slug, min: 1, max: 32)
    |> unique_constraint([:org_id, :slug])
  end
end
