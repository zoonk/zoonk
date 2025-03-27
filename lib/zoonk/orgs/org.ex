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

  ## Organization Types

  | Type | Description |
  |------|-------------|
  | `:main` | The main organization that owns this entire app (e.g. Zoonk) |
  | `:team` | Organizations using Zoonk for internal training. |
  | `:creator` | Organizations selling content on Zoonk. |
  | `:school` | Educational institutions using Zoonk with their existing students. |

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `currency` | `Ecto.Enum` | Currency used for payments. |
  | `kind` | `Ecto.Enum` | The type of organization. |
  | `stripe_customer_id` | `String` | Customer ID used for Stripe payments. |
  | `tax_id` | `Zoonk.Vault.Binary` | Tax ID required by some jurisdictions. |
  | `profile` | `Zoonk.Orgs.OrgProfile` | Profile visible to org members. |
  | `members` | `Zoonk.Orgs.Member` | List all members associated with this organization. |
  | `inserted_at` | `DateTime` | Timestamp when the organization was created. |
  | `updated_at` | `DateTime` | Timestamp when the organization was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Config.CurrencyConfig
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Orgs.OrgProfile
  alias Zoonk.Vault

  schema "orgs" do
    field :currency, Ecto.Enum, values: CurrencyConfig.list_currencies(:atom), default: :USD
    field :kind, Ecto.Enum, values: [:main, :team, :creator, :school], default: :team

    field :stripe_customer_id, :string
    field :tax_id, Vault.Binary

    has_one :profile, OrgProfile
    has_many :members, OrgMember

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(org, attrs) do
    org
    |> cast(attrs, [:currency, :kind, :stripe_customer_id, :tax_id])
    |> validate_required([:currency, :kind])
  end
end
