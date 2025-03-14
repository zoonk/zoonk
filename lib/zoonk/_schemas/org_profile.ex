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
  | `subdomain` | `String` | The subdomain used for the organization's white-label page. |
  | `custom_domain` | `String` | The custom domain used for the organization's white-label page. |
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

    field :subdomain, :string
    field :custom_domain, :string

    field :icon_url, :string
    field :logo_url, :string

    belongs_to :org, Org
    belongs_to :city, City

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :display_name,
      :bio,
      :public_email,
      :icon_url,
      :logo_url,
      :subdomain,
      :custom_domain,
      :city_id,
      :org_id
    ])
    |> validate_required([:display_name, :org_id, :subdomain])
    |> validate_length(:display_name, min: 1, max: 32)
    |> unsafe_validate_unique(:subdomain, Zoonk.Repo)
    |> unsafe_validate_unique(:custom_domain, Zoonk.Repo)
    |> unique_constraint(:subdomain)
    |> unique_constraint(:custom_domain)
    |> unique_constraint(:org_id)
  end
end
