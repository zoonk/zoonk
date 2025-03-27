defmodule Zoonk.Orgs.OrgSettings do
  @moduledoc """
  Defines the `OrgSettings` schema.

  It handles the private settings for an organization.

  While `Zoonk.Orgs.Org` handles the public information
  shown to users, this module manages settings visible
  only to org admins or app admins.
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Config.CurrencyConfig
  alias Zoonk.Orgs.Org
  alias Zoonk.Vault

  schema "org_settings" do
    field :currency, Ecto.Enum, values: CurrencyConfig.list_currencies(:atom), default: :USD
    field :stripe_customer_id, :string
    field :tax_id, Vault.Binary

    belongs_to :org, Org

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(org, attrs) do
    org
    |> cast(attrs, [:currency, :org_id, :stripe_customer_id, :tax_id])
    |> validate_required([:currency, :org_id])
    |> unique_constraint(:org_id)
  end
end
