defmodule Zoonk.Config.CurrencyConfig do
  @moduledoc """
  Manages supported currency configurations for the application.

  This module centralizes all currency-related settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """

  @supported_currencies [
    USD: "United States Dollar",
    EUR: "Euro",
    AUD: "Australian Dollar",
    BRL: "Real Brasileiro",
    CAD: "Canadian Dollar",
    CLP: "Peso Chileno",
    CNY: "人民币",
    GBP: "British Pound Sterling",
    HKD: "Hong Kong Dollar",
    JPY: "日本円",
    KRW: "대한민국 원",
    MXN: "Peso Mexicano",
    NZD: "New Zealand Dollar",
    SGD: "Singapore Dollar",
    TRY: "Türk Lirası",
    TWD: "新台币",
    UYU: "Peso Uruguayo"
  ]

  @doc """
  Lists all supported currencies.

  ## Example
      iex> list_currencies(:atom)
      [:USD, :EUR, :GBP, ...]

      iex> list_currencies(:string)
      ["USD", "EUR", "GBP", ...]

      iex> list_currencies(:options)
      [{"United States Dollar", "USD"}, {"Euro", "EUR"}, ...]
  """
  def list_currencies(:atom), do: Enum.map(@supported_currencies, fn {key, _value} -> key end)
  def list_currencies(:string), do: Enum.map(@supported_currencies, fn {key, _value} -> Atom.to_string(key) end)
  def list_currencies(:options), do: Enum.map(@supported_currencies, fn {key, value} -> {value, Atom.to_string(key)} end)
end
