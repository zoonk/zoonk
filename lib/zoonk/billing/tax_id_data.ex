defmodule Zoonk.Billing.TaxIdData do
  @moduledoc """
  Provides data for tax ID types and their associated countries.

  These are the Tax ID types [used by Stripe](https://docs.stripe.com/billing/customer/tax-ids).
  """

  @tax_id_types [
    "ad_nrt",
    "ae_trn",
    "al_tin",
    "am_tin",
    "ao_tin",
    "ar_cuit",
    "au_abn",
    "au_arn",
    "aw_tin",
    "az_tin",
    "ba_tin",
    "bb_tin",
    "bd_bin",
    "bf_ifu",
    "bg_uic",
    "bh_vat",
    "bj_ifu",
    "bo_tin",
    "br_cnpj",
    "br_cpf",
    "bs_tin",
    "by_tin",
    "ca_bn",
    "ca_gst_hst",
    "ca_pst_bc",
    "ca_pst_mb",
    "ca_pst_sk",
    "ca_qst",
    "cd_nif",
    "ch_uid",
    "ch_vat",
    "cl_tin",
    "cm_niu",
    "cn_tin",
    "co_nit",
    "cr_tin",
    "cv_nif",
    "de_stn",
    "do_rcn",
    "ec_ruc",
    "eg_tin",
    "es_cif",
    "et_tin",
    "eu_oss_vat",
    "eu_vat",
    "gb_vat",
    "ge_vat",
    "gn_nif",
    "hk_br",
    "hr_oib",
    "hu_tin",
    "id_npwp",
    "il_vat",
    "in_gst",
    "is_vat",
    "jp_cn",
    "jp_rn",
    "jp_trn",
    "ke_pin",
    "kg_tin",
    "kh_tin",
    "kr_brn",
    "kz_bin",
    "la_tin",
    "li_uid",
    "li_vat",
    "ma_vat",
    "md_vat",
    "me_pib",
    "mk_vat",
    "mr_nif",
    "mx_rfc",
    "my_frp",
    "my_itn",
    "my_sst",
    "ng_tin",
    "no_vat",
    "no_voec",
    "np_pan",
    "nz_gst",
    "om_vat",
    "pe_ruc",
    "ph_tin",
    "ro_tin",
    "rs_pib",
    "ru_inn",
    "ru_kpp",
    "sa_vat",
    "sg_gst",
    "sg_uen",
    "si_tin",
    "sn_ninea",
    "sr_fin",
    "sv_nit",
    "th_vat",
    "tj_tin",
    "tr_tin",
    "tw_vat",
    "tz_vat",
    "ua_vat",
    "ug_tin",
    "us_ein",
    "uy_ruc",
    "uz_tin",
    "uz_vat",
    "ve_rif",
    "vn_tin",
    "za_vat",
    "zm_tin",
    "zw_tin"
  ]

  # EU countries that can use EU VAT or EU OSS VAT
  @eu_countries ~w[at be cy cz dk ee fi fr de gr ie it lv lt lu mt nl pl pt sk si es se]
  @eu_vat_types ~w(eu_vat eu_oss_vat)

  @country_tax_map Enum.group_by(@tax_id_types, fn <<cc::binary-size(2), _rest::binary>> -> cc end)

  @doc """
  Returns tax ID types and their display names for a given country ISO2 code.

  Returns a list of tuples where each tuple contains {display_name, type}.

  ## Examples

      iex> types_for_country("US")
      [{"EIN", "us_ein"}]

      iex> types_for_country("BR")
      [{"CNPJ", "br_cnpj"}, {"CPF", "br_cpf"}]

      iex> types_for_country("DE")
      [{"STN", "de_stn"}, {"VAT", "eu_vat"}, {"OSS VAT", "eu_oss_vat"}]
  """
  def types_for_country(iso2) when is_binary(iso2) do
    code = String.downcase(iso2)

    code
    |> base_tax_types()
    |> maybe_add_eu_taxes(code)
    |> Enum.map(&{format_display_name(&1), &1})
  end

  defp base_tax_types(code), do: Map.get(@country_tax_map, code, [])

  defp maybe_add_eu_taxes(types, iso2) when iso2 in @eu_countries, do: types ++ @eu_vat_types
  defp maybe_add_eu_taxes(types, _iso2), do: types

  # remove country code prefix and format display name
  defp format_display_name(<<_iso::binary-size(2), "_" <> rest>>), do: format_display_name(rest)

  defp format_display_name(type) do
    type
    |> String.replace("_", " ")
    |> String.upcase()
  end
end
