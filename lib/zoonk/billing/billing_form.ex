defmodule Zoonk.Billing.BillingForm do
  @moduledoc """
  A form schema for billing account setup.

  This schema handles additional fields needed for the billing form
  that aren't part of the BillingAccount schema, such as address
  and tax ID information that gets stored in Stripe.
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Locations

  @primary_key false
  embedded_schema do
    field :country_iso2, :string
    field :currency, :string
    field :tax_id_type, :string
    field :tax_id, :string
    field :address_line_1, :string
    field :address_line_2, :string
    field :city, :string
    field :state, :string
    field :postal_code, :string
  end

  @doc """
  Creates a changeset for the billing form.

  Only country and currency are required fields.
  """
  def changeset(billing_form, attrs \\ %{}) do
    billing_form
    |> cast(attrs, [
      :country_iso2,
      :currency,
      :tax_id_type,
      :tax_id,
      :address_line_1,
      :address_line_2,
      :city,
      :state,
      :postal_code
    ])
    |> validate_required([:country_iso2, :currency])
    |> validate_length(:country_iso2, is: 2, message: "must be a valid ISO 3166-1 alpha-2 code")
    |> validate_length(:currency, is: 3, message: "must be a valid ISO 4217 currency code")
    |> update_change(:currency, &String.upcase/1)
    |> update_change(:country_iso2, &String.upcase/1)
    |> validate_tax_id_type()
    |> validate_tax_id()
  end

  defp validate_tax_id_type(changeset) do
    country = get_field(changeset, :country_iso2)
    tax_id_type = get_field(changeset, :tax_id_type)

    if country && tax_id_type do
      valid_types = Locations.list_tax_id_types(country) |> Enum.map(&elem(&1, 0))

      if tax_id_type in valid_types do
        changeset
      else
        add_error(changeset, :tax_id_type, "is not valid for the selected country")
      end
    else
      changeset
    end
  end

  defp validate_tax_id(changeset) do
    tax_id_type = get_field(changeset, :tax_id_type)
    tax_id = get_field(changeset, :tax_id)

    # If tax_id_type is provided, tax_id must also be provided
    if tax_id_type && !tax_id do
      add_error(changeset, :tax_id, "can't be blank when tax ID type is provided")
    else
      changeset
    end
  end
end