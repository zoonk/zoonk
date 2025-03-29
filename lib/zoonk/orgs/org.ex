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

  ## Why the main app is an organization?

  The main app is also an organization because it allows us to query everything
  using an `org_id`, ensuring users have access to the correct scope.

  Without this, we would need to add a lot of `org_id` checks
  everywhere in the codebase, which would be a nightmare to maintain.

  Plus, we'd need to check for `is_nil(org_id)` everywhere when we need to
  query data that is not related to main app only - and not to a specific organization.

  Having an `org_id` associated with every data makes it easier to
  manage permissions and access control.

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
  | `city_id` | `Integer` | ID from `Zoonk.Locations.City` |
  | `inserted_at` | `DateTime` | Timestamp when the organization profile was created. |
  | `updated_at` | `DateTime` | Timestamp when the organization profile was last updated. |
  """
  use Ecto.Schema
  use Gettext, backend: Zoonk.Gettext

  import Ecto.Changeset

  alias Zoonk.Config.SubdomainConfig
  alias Zoonk.Locations.City

  schema "orgs" do
    field :kind, Ecto.Enum, values: [:app, :team, :creator, :school], default: :team
    field :display_name, :string
    field :bio, :string
    field :public_email, :string
    field :icon_url, :string
    field :logo_url, :string

    field :subdomain, :string
    field :custom_domain, :string

    belongs_to :city, City

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(org, attrs) do
    org
    |> cast(attrs, [
      :bio,
      :city_id,
      :kind,
      :custom_domain,
      :display_name,
      :icon_url,
      :logo_url,
      :public_email,
      :subdomain
    ])
    |> validate_required([:display_name, :subdomain])
    |> validate_length(:display_name, min: 1, max: 32)
    |> validate_length(:subdomain, min: 2, max: 32)
    |> validate_format(:subdomain, ~r/^[a-zA-Z0-9_-]+$/,
      message: dgettext("errors", "cannot have spaces for special characters")
    )
    |> validate_format(:subdomain, ~r/[a-zA-Z]/, message: dgettext("errors", "must have letters"))
    |> validate_exclusion(:subdomain, SubdomainConfig.list_reserved_subdomains())
    |> unsafe_validate_unique(:subdomain, Zoonk.Repo)
    |> unsafe_validate_unique(:custom_domain, Zoonk.Repo)
    |> unique_constraint(:subdomain)
    |> unique_constraint(:custom_domain)
  end
end
