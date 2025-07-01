defmodule Zoonk.Billing.BillingFormTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.Billing.BillingForm

  describe "changeset/2" do
    test "valid changeset with required fields" do
      attrs = %{
        country_iso2: "US",
        currency: "USD"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      assert changeset.valid?
      assert changeset.changes.country_iso2 == "US"
      assert changeset.changes.currency == "USD"
    end

    test "valid changeset with all fields" do
      attrs = %{
        country_iso2: "US",
        currency: "USD",
        tax_id_type: "us_ein",
        tax_id: "12-3456789",
        address_line_1: "123 Main St",
        address_line_2: "Apt 4B",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      assert changeset.valid?
      assert changeset.changes.country_iso2 == "US"
      assert changeset.changes.currency == "USD"
      assert changeset.changes.tax_id_type == "us_ein"
      assert changeset.changes.tax_id == "12-3456789"
      assert changeset.changes.address_line_1 == "123 Main St"
    end

    test "normalizes country and currency to uppercase" do
      attrs = %{
        country_iso2: "us",
        currency: "usd"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      assert changeset.valid?
      assert changeset.changes.country_iso2 == "US"
      assert changeset.changes.currency == "USD"
    end

    test "requires country_iso2" do
      attrs = %{currency: "USD"}

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).country_iso2
    end

    test "requires currency" do
      attrs = %{country_iso2: "US"}

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).currency
    end

    test "validates country_iso2 length" do
      attrs = %{
        country_iso2: "USA",
        currency: "USD"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      refute changeset.valid?
      assert "must be a valid ISO 3166-1 alpha-2 code" in errors_on(changeset).country_iso2
    end

    test "validates currency length" do
      attrs = %{
        country_iso2: "US",
        currency: "USDD"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      refute changeset.valid?
      assert "must be a valid ISO 4217 currency code" in errors_on(changeset).currency
    end

    test "validates tax_id_type for country" do
      attrs = %{
        country_iso2: "US",
        currency: "USD",
        tax_id_type: "invalid_type",
        tax_id: "123456789"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      refute changeset.valid?
      assert "is not valid for the selected country" in errors_on(changeset).tax_id_type
    end

    test "requires tax_id when tax_id_type is provided" do
      attrs = %{
        country_iso2: "US",
        currency: "USD",
        tax_id_type: "us_ein"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      refute changeset.valid?
      assert "can't be blank when tax ID type is provided" in errors_on(changeset).tax_id
    end

    test "accepts valid tax_id_type for country" do
      attrs = %{
        country_iso2: "US",
        currency: "USD",
        tax_id_type: "us_ein",
        tax_id: "12-3456789"
      }

      changeset = BillingForm.changeset(%BillingForm{}, attrs)

      assert changeset.valid?
    end
  end
end