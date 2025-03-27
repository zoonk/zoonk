defmodule Zoonk.Config.LanguageConfig do
  @moduledoc """
  Manages supported language configurations for the application.

  This module centralizes all language-related settings used throughout
  the application, ensuring consistency and ease of maintenance.
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

  @default_language "en"

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
end
