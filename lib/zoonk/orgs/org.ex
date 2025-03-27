defmodule Zoonk.Orgs.Org do
  @moduledoc """
  Defines the `Org` schema.

  Every data on Zoonk is related to an organization.
  An organization can be a business, a creator, or a school.

  All organizations have a subdomain that can be used
  for their white-label page, e.g. `https://<subdomain>.zoonk.io`.

  Some orgs can also have a custom domain, e.g. `https://<custom_domain>`.
  This is useful for schools and businesses that want to
  use their own domain for their white-label page.

  This schema manages public information about the organization.
  For private settings, see `Zoonk.Orgs.OrgSettings`.

  ## Organization Types

  | Type | Description |
  |------|-------------|
  | `:app` | The main organization that owns this entire app (e.g. Zoonk) |
  | `:team` | Organizations using Zoonk for internal training. |
  | `:creator` | Organizations selling content on Zoonk. |
  | `:school` | Educational institutions using Zoonk with their existing students. |

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `kind` | `Ecto.Enum` | The type of organization. |
  | `display_name` | `String` | The name of the organization as it will be displayed to users. |
  | `bio` | `String` | A brief description of the organization. |
  | `public_email` | `String` | The public email address for the organization. |
  | `icon_url` | `String` | URL for the organization's icon. |
  | `logo_url` | `String` | URL for the organization's logo. |
  | `subdomain` | `String` | The subdomain used for the organization's white-label page. |
  | `custom_domain` | `String` | The custom domain used for the organization's white-label page. |
  | `org_id` | `Integer` | ID from `Zoonk.Locations.Org` |
  | `city_id` | `Integer` | ID from `Zoonk.Locations.City` |
  | `inserted_at` | `DateTime` | Timestamp when the organization profile was created. |
  | `updated_at` | `DateTime` | Timestamp when the organization profile was last updated. |
  """
  use Ecto.Schema
  use Gettext, backend: Zoonk.Gettext

  import Ecto.Changeset

  alias Zoonk.Locations.City
  alias Zoonk.Orgs.Org

  schema "orgs" do
    field :kind, Ecto.Enum, values: [:app, :team, :creator, :school], default: :team
    field :display_name, :string
    field :bio, :string
    field :public_email, :string
    field :icon_url, :string
    field :logo_url, :string

    field :subdomain, :string
    field :custom_domain, :string

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
    |> validate_length(:subdomain, min: 1, max: 32)
    |> validate_format(:subdomain, ~r/^[a-zA-Z0-9_-]+$/,
      message: "can only contain letters, numbers, underscores, and hyphens"
    )
    |> unsafe_validate_unique(:subdomain, Zoonk.Repo)
    |> unsafe_validate_unique(:custom_domain, Zoonk.Repo)
    |> unique_constraint(:subdomain)
    |> unique_constraint(:custom_domain)
  end
end
