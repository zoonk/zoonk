defmodule Zoonk.Billing.BillingAccount do
  @moduledoc """
  Defines the `BillingAccount` schema.

  This schema centralizes billing information for both users and organizations.
  Each billing account is associated with either a user or an organization, but not both.

  ## Fields

  | Field Name           | Type         | Description                                                       |
  |----------------------|--------------|-------------------------------------------------------------------|
  | `country_iso2`       | `String`     | The ISO 3166-1 alpha-2 code of the country for billing purposes.  |
  | `currency`           | `String`     | The currency used for billing purposes.                           |
  | `stripe_customer_id` | `String`     | The Stripe customer ID for payment processing.                    |
  | `user_id`            | `Integer`    | The ID of the `Zoonk.Accounts.User` this account belongs to.      |
  | `org_id`             | `Integer`    | The ID of the `Zoonk.Orgs.Org` this account belongs to.           |
  | `inserted_at`        | `DateTime`   | Timestamp when the billing account was created.                   |
  | `updated_at`         | `DateTime`   | Timestamp when the billing account was last updated.              |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Orgs.Org

  schema "billing_accounts" do
    field :country_iso2, :string
    field :currency, :string
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
    |> cast(attrs, [:country_iso2, :currency, :stripe_customer_id])
    |> validate_required([:country_iso2, :currency])
    |> validate_length(:country_iso2, is: 2, message: "must be a valid ISO 3166-1 alpha-2 code")
    |> validate_length(:currency, is: 3, message: "must be a valid ISO 4217 currency code")
    |> update_change(:currency, &String.upcase/1)
    |> update_change(:country_iso2, &String.upcase/1)
    |> validate_format(:stripe_customer_id, ~r/^cus_/, message: "must start with cus_")
    |> validate_user_or_org()
  end

  defp validate_user_or_org(changeset) do
    org_id = get_field(changeset, :org_id)
    user_id = get_field(changeset, :user_id)
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
