defmodule Zoonk.Schemas.Org do
  @moduledoc """
  Defines the `Org` schema.

  Every data on Zoonk is related to an organization.
  An organization can be a business, a creator, or a school.

  All organizations have a subdomain that can be used
  for their white-label page, e.g. `https://<subdomain>.zoonk.io`.

  Some orgs can also have a custom domain, e.g. `https://<custom_domain>`.
  This is useful for schools and businesses that want to
  use their own domain for their white-label page.

  ## Organization Types

  | Type | Description |
  |------|-------------|
  | `:business` | Organizations using Zoonk for internal training. |
  | `:creator` | Organizations selling content on Zoonk. |
  | `:school` | Educational institutions using Zoonk with their existing students. |

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `currency` | `Ecto.Enum` | Currency used for payments. |
  | `kind` | `Ecto.Enum` | The type of organization. |
  | `stripe_customer_id` | `String` | Customer ID used for Stripe payments. |
  | `tax_id` | `Zoonk.Encrypted.Binary` | Tax ID required by some jurisdictions. |
  | `profile` | `Zoonk.Schemas.OrgProfile` | Profile visible to org members. |
  | `teams` | `Zoonk.Schemas.Team` | Organizations can create multiple teams. |
  | `members` | `Zoonk.Schemas.Member` | List all members associated with this organization. |
  | `inserted_at` | `DateTime` | Timestamp when the organization was created. |
  | `updated_at` | `DateTime` | Timestamp when the organization was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Configuration
  alias Zoonk.Schemas.Member
  alias Zoonk.Schemas.OrgProfile
  alias Zoonk.Schemas.Team

  schema "orgs" do
    field :currency, Ecto.Enum, values: Configuration.list_currencies(:atom), default: :USD
    field :kind, Ecto.Enum, values: [:business, :creator, :school], default: :business

    field :stripe_customer_id, :string
    field :tax_id, Zoonk.Encrypted.Binary

    has_one :profile, OrgProfile
    has_many :teams, Team
    has_many :members, Member

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(org, attrs) do
    org
    |> cast(attrs, [:currency, :kind, :stripe_customer_id, :tax_id])
    |> validate_required([:currency, :kind])
    |> validate_length(:subdomain, min: 1, max: 32)
  end
end
