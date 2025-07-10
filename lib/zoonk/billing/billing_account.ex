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

    # Virtual fields for form data, used for Stripe integration only, not stored in the database
    field :name, :string, virtual: true
    field :phone, :string, virtual: true
    field :address_line_1, :string, virtual: true
    field :address_line_2, :string, virtual: true
    field :city, :string, virtual: true
    field :state, :string, virtual: true
    field :postal_code, :string, virtual: true
    field :tax_id, :string, virtual: true
    field :tax_id_type, :string, virtual: true

    belongs_to :user, User
    belongs_to :org, Org

    timestamps(type: :utc_datetime_usec)
  end

  @doc """
  Creates a changeset for the billing account form.

  This changeset includes additional fields that are sent to Stripe
  but not stored in the database.
  """
  def form_changeset(billing_account, attrs) do
    billing_account
    |> cast(attrs, [
      :name,
      :phone,
      :address_line_1,
      :address_line_2,
      :city,
      :state,
      :postal_code,
      :tax_id,
      :tax_id_type
    ])
    |> changeset(attrs)
  end

  @doc """
  Changeset for updating the billing account.
  """
  def changeset(billing_account, attrs) do
    billing_account
    |> cast(attrs, [:country_iso2, :currency])
    |> validate_required([:country_iso2, :currency])
    |> validate_length(:country_iso2, is: 2, message: "must be a valid ISO 3166-1 alpha-2 code")
    |> validate_length(:currency, is: 3, message: "must be a valid ISO 4217 currency code")
    |> update_change(:currency, &String.upcase/1)
    |> update_change(:country_iso2, &String.upcase/1)
  end

  @doc """
  Creates a changeset for the billing account.

  It enforces that either a user_id or an org_id is present, but not both.
  """
  def create_changeset(billing_account, attrs) do
    billing_account
    |> changeset(attrs)
    |> cast(attrs, [:stripe_customer_id, :user_id, :org_id])
    |> validate_format(:stripe_customer_id, ~r/^cus_/, message: "must start with cus_")
    |> validate_user_or_org()
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:org_id)
    |> unique_constraint(:user_id)
    |> unique_constraint(:org_id)
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
