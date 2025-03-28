defmodule Zoonk.Orgs.OrgSettings do
  @moduledoc """
  Defines the `OrgSettings` schema.

  It handles the private settings for an organization.

  While `Zoonk.Orgs.Org` handles the public information
  shown to users, this module manages settings visible
  only to org admins or app admins.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `allowed_domains` | `array` | Domains that allow users to automatically sign in/up. If empty, admins need to manually add users. |
  | `currency` | `Ecto.Enum` | The currency used by the organization. |
  | `stripe_customer_id` | `String` | The Stripe customer ID for the organization. |
  | `tax_id` | `Zoonk.Vault.Binary` | The tax ID for the organization, stored securely. |
  | `org_id` | `Integer` | The ID of the `Zoonk.Orgs.Org` this settings belongs to. |
  | `inserted_at` | `DateTime` | Timestamp when the settings were created. |
  | `updated_at` | `DateTime` | Timestamp when the settings were last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Config.CurrencyConfig
  alias Zoonk.Orgs.Org
  alias Zoonk.Vault

  schema "org_settings" do
    field :allowed_domains, {:array, :string}, default: []
    field :currency, Ecto.Enum, values: CurrencyConfig.list_currencies(:atom), default: :USD
    field :stripe_customer_id, :string
    field :tax_id, Vault.Binary

    belongs_to :org, Org

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(org, attrs) do
    org
    |> cast(attrs, [:currency, :org_id, :stripe_customer_id, :tax_id, :allowed_domains])
    |> validate_required([:currency, :org_id])
    |> unique_constraint(:org_id)
  end
end
