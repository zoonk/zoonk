defmodule Zoonk.Billing.BillingAccount do
  @moduledoc """
  Defines the `BillingAccount` schema.

  This schema centralizes billing information for both users and organizations.
  Each billing account is associated with either a user or an organization, but not both.

  ## Fields

  | Field Name           | Type         | Description                                                       |
  |----------------------|--------------|-------------------------------------------------------------------|
  | `currency`           | `Ecto.Enum`  | The currency used for billing purposes.                           |
  | `stripe_customer_id` | `String`     | The Stripe customer ID for payment processing.                    |
  | `user_id`            | `Integer`    | The ID of the `Zoonk.Accounts.User` this account belongs to.      |
  | `org_id`             | `Integer`    | The ID of the `Zoonk.Orgs.Org` this account belongs to.           |
  | `inserted_at`        | `DateTime`   | Timestamp when the billing account was created.                   |
  | `updated_at`         | `DateTime`   | Timestamp when the billing account was last updated.              |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Config.CurrencyConfig
  alias Zoonk.Orgs.Org

  schema "billing_accounts" do
    field :currency, Ecto.Enum, values: CurrencyConfig.list_currencies(:atom)
    field :stripe_customer_id, :string

    belongs_to :user, User
    belongs_to :org, Org

    timestamps(type: :utc_datetime_usec)
  end

  @doc """
  Creates a changeset for the billing account.

  It enforces that either a user_id or an org_id is present, but not both.
  """
  def changeset(billing_account, attrs) do
    billing_account
    |> cast(attrs, [:currency, :stripe_customer_id, :user_id, :org_id])
    |> validate_required([:currency])
    |> validate_user_or_org()
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:org_id)
    |> unique_constraint(:user_id)
    |> unique_constraint(:org_id)
  end

  defp validate_user_or_org(changeset) do
    user_id = get_field(changeset, :user_id)
    org_id = get_field(changeset, :org_id)
    validate_user_or_org(changeset, org_id, user_id)
  end

  defp validate_user_or_org(changeset, nil, nil) do
    add_error(changeset, :base, "must have either user_id or org_id")
  end

  defp validate_user_or_org(changeset, org_id, user_id) when is_integer(org_id) and is_integer(user_id) do
    add_error(changeset, :base, "cannot have both user_id and org_id")
  end

  defp validate_user_or_org(changeset, _org_id, _user_id), do: changeset
end
