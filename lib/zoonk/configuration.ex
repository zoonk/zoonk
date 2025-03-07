defmodule Zoonk.Configuration do
  @moduledoc """
  Centralizes configuration settings and constants for the application.

  This module provides a single source of truth for various
  configuration parameters and constants used throughout the
  application.

  It ensures consistency, ease of maintenance, and simplifies
  the management of application-wide settings.
  """

  @supported_languages [
    en: "English",
    de: "Deutsch",
    es: "Español",
    fr: "Français",
    it: "Italiano",
    ja: "日本語",
    ko: "한국어",
    pt: "Português",
    tr: "Türkçe",
    zh_Hans: "简体中文",
    zh_Hant: "繁體中文"
  ]

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

  @default_language "en"

  @doc group: "Authentication"
  @doc """
  Returns the default hash algorithm.
  """
  def get_hash_algorithm, do: :sha256

  @doc group: "Authentication"
  @doc """
  Returns the maximum age or validity of an item.

  For magic link tokens, it is very important to keep their expiry short,
  since someone with access to the email may take over the account.

  ## Example

      iex> get_max_age(:token, :days)
      365

      iex> get_max_age(:token, :seconds)
      31536000

      iex> get_max_age(:magic_link, :minutes)
      15

      iex> get_max_age(:change_email, :days)
      7

      iex> get_max_age(:sudo_mode, :minutes)
      -10
  """
  def get_max_age(:token, :days), do: 365
  def get_max_age(:token, :seconds), do: get_max_age(:token, :days) * 24 * 60 * 60
  def get_max_age(:magic_link, :minutes), do: 15
  def get_max_age(:change_email, :days), do: 7
  def get_max_age(:sudo_mode, :minutes), do: -10

  @doc group: "Authentication"
  @doc """
  Returns the name of a cookie.

  ## Example

      iex> get_cookie_name(:remember_me)
      "_zoonk_web_user_remember_me"
  """
  def get_cookie_name(:remember_me), do: "_zoonk_web_user_remember_me"

  @doc group: "Authentication"
  @doc """
  Returns a list of supported oAuth providers.
  """
  def list_providers, do: [:apple, :github, :google, :microsoft]

  @doc group: "Language"
  @doc """
  Returns a list of supported languages.

  ## Example

      iex> list_languages(:atom)
      [:en, :de, :es, :fr, :it, :ja, :ko, :pt, :tr, :zh_Hans, :zh_Hant]

      iex> list_languages(:string)
      ["en", "de", "es", "fr", "it", "ja", "ko", "pt", "tr", "zh_Hans", "zh_Hant"]

      iex> list_languages(:options)
      [{"English", "en"}, {"Deutsch", "de"}, {"Español", "es"}, ...]
  """
  def list_languages(:atom) do
    Enum.map(@supported_languages, fn {key, _value} -> key end)
  end

  def list_languages(:string) do
    Enum.map(@supported_languages, fn {key, _value} -> Atom.to_string(key) end)
  end

  def list_languages(:options) do
    Enum.map(@supported_languages, fn {key, value} -> {value, Atom.to_string(key)} end)
  end

  @doc group: "Language"
  @doc """
  Returns an atom with the default language key.

  ## Example

      iex> get_default_language(:atom)
      :en

      iex> get_default_language(:string)
      "en"

  """
  def get_default_language(:atom), do: String.to_existing_atom(@default_language)
  def get_default_language(:string), do: @default_language

  @doc group: "Billing"
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
