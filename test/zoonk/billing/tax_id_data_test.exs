defmodule Zoonk.Billing.TaxIdDataTest do
  use ExUnit.Case, async: true

  alias Zoonk.Billing.TaxIdData

  describe "types_for_country/1" do
    test "returns correct tax ID types for US" do
      result = TaxIdData.types_for_country("US")

      assert result == [{"US_EIN", "us_ein"}]
    end

    test "returns correct tax ID types for Brazil with multiple types" do
      result = TaxIdData.types_for_country("BR")

      assert result == [{"BR_CNPJ", "br_cnpj"}, {"BR_CPF", "br_cpf"}]
    end

    test "returns country-specific and EU tax types for EU country (Germany)" do
      result = TaxIdData.types_for_country("DE")

      expected = [{"DE_STN", "de_stn"}, {"EU_VAT", "eu_vat"}, {"EU_OSS_VAT", "eu_oss_vat"}]
      assert result == expected
    end

    test "returns country-specific and EU tax types for EU country (France)" do
      result = TaxIdData.types_for_country("FR")

      # France doesn't have specific tax types in the list, only EU types
      expected = [{"EU_VAT", "eu_vat"}, {"EU_OSS_VAT", "eu_oss_vat"}]
      assert result == expected
    end

    test "returns empty list for country with no tax ID types" do
      result = TaxIdData.types_for_country("XX")

      assert result == []
    end

    test "handles lowercase country codes" do
      result = TaxIdData.types_for_country("us")

      assert result == [{"US_EIN", "us_ein"}]
    end

    test "returns correct tax ID types for Canada with multiple types" do
      result = TaxIdData.types_for_country("CA")

      expected = [
        {"CA_BN", "ca_bn"},
        {"CA_GST_HST", "ca_gst_hst"},
        {"CA_PST_BC", "ca_pst_bc"},
        {"CA_PST_MB", "ca_pst_mb"},
        {"CA_PST_SK", "ca_pst_sk"},
        {"CA_QST", "ca_qst"}
      ]

      assert result == expected
    end

    test "returns correct tax ID types for non-EU country (UK)" do
      result = TaxIdData.types_for_country("GB")

      assert result == [{"GB_VAT", "gb_vat"}]
    end
  end
end
