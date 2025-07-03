defmodule Zoonk.Billing.TaxIdDataTest do
  use ExUnit.Case, async: true

  alias Zoonk.Billing.TaxIdData

  describe "types_for_country/1" do
    test "returns correct tax ID types for US" do
      result = TaxIdData.types_for_country("US")

      assert result == [{"EIN", "us_ein"}]
    end

    test "returns correct tax ID types for Brazil with multiple types" do
      result = TaxIdData.types_for_country("BR")

      assert result == [{"CNPJ", "br_cnpj"}, {"CPF", "br_cpf"}]
    end

    test "returns country-specific and EU tax types for EU country (Germany)" do
      result = TaxIdData.types_for_country("DE")

      expected = [{"STN", "de_stn"}, {"VAT", "eu_vat"}, {"OSS VAT", "eu_oss_vat"}]
      assert result == expected
    end

    test "returns country-specific and EU tax types for EU country (France)" do
      result = TaxIdData.types_for_country("FR")

      # France doesn't have specific tax types in the list, only EU types
      expected = [{"VAT", "eu_vat"}, {"OSS VAT", "eu_oss_vat"}]
      assert result == expected
    end

    test "returns empty list for country with no tax ID types" do
      result = TaxIdData.types_for_country("XX")

      assert result == []
    end

    test "handles lowercase country codes" do
      result = TaxIdData.types_for_country("us")

      assert result == [{"EIN", "us_ein"}]
    end

    test "returns correct tax ID types for Canada with multiple types" do
      result = TaxIdData.types_for_country("CA")

      expected = [
        {"BN", "ca_bn"},
        {"GST HST", "ca_gst_hst"},
        {"PST BC", "ca_pst_bc"},
        {"PST MB", "ca_pst_mb"},
        {"PST SK", "ca_pst_sk"},
        {"QST", "ca_qst"}
      ]

      assert result == expected
    end

    test "returns correct tax ID types for non-EU country (UK)" do
      result = TaxIdData.types_for_country("GB")

      assert result == [{"VAT", "gb_vat"}]
    end
  end
end
