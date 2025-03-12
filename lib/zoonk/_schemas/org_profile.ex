defmodule Zoonk.Schemas.OrgProfile do
  @moduledoc """
  Defines the `OrgProfile` schema.

  Every organization has a profile.
  This is separate from `Zoonk.Schemas.Org` to
  avoid mixing up an org's settings and information
  visible to org members.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `display_name` | `String` | The name of the organization as it will be displayed to users. |
  | `bio` | `String` | A brief description of the organization. |
  | `public_email` | `String` | The public email address for the organization. |
  | `icon_url` | `String` | URL for the organization's icon. |
  | `logo_url` | `String` | URL for the organization's logo. |
  | `org_id` | `Integer` | ID from `Zoonk.Schemas.Org` |
  | `city_id` | `Integer` | ID from `Zoonk.Schemas.City` |
  | `inserted_at` | `DateTime` | Timestamp when the organization profile was created. |
  | `updated_at` | `DateTime` | Timestamp when the organization profile was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Schemas.City
  alias Zoonk.Schemas.Org

  schema "org_profiles" do
    field :display_name, :string
    field :bio, :string
    field :public_email, :string

    field :icon_url, :string
    field :logo_url, :string

    belongs_to :org, Org
    belongs_to :city, City

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [:display_name, :bio, :public_email, :icon_url, :logo_url, :city_id, :org_id])
    |> validate_required([:display_name, :org_id])
    |> validate_length(:display_name, min: 1, max: 32)
    |> unique_constraint(:org_id)
  end
end
