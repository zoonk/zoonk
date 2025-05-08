defmodule Zoonk.Config.CurrencyConfig do
  @moduledoc """
  Manages supported currency configurations for the application.

  This module centralizes all currency-related settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """

  @supported_currencies [
    usd: "United States Dollar",
    eur: "Euro",
    aud: "Australian Dollar",
    brl: "Real Brasileiro",
    cad: "Canadian Dollar",
    clp: "Peso Chileno",
    cny: "人民币",
    gbp: "British Pound Sterling",
    hkd: "Hong Kong Dollar",
    jpy: "日本円",
    krw: "대한민국 원",
    mxn: "Peso Mexicano",
    nzd: "New Zealand Dollar",
    sgd: "Singapore Dollar",
    try: "Türk Lirası",
    twd: "新台币",
    uy: "Peso Uruguayo"
  ]

  @doc """
  Lists all supported currencies.

  ## Example
      iex> list_currencies(:atom)
      [:usd, :eur, :gbp, ...]

      iex> list_currencies(:string)
      ["usd", "eur", "gbp", ...]

      iex> list_currencies(:options)
      [{"United States Dollar", "usd"}, {"Euro", "eur"}, ...]
  """
  def list_currencies(:atom), do: Enum.map(@supported_currencies, fn {key, _value} -> key end)
  def list_currencies(:string), do: Enum.map(@supported_currencies, fn {key, _value} -> Atom.to_string(key) end)
  def list_currencies(:options), do: Enum.map(@supported_currencies, fn {key, value} -> {value, Atom.to_string(key)} end)
end
