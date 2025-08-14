defmodule Zoonk.Localization do
  @moduledoc """
  Manages supported language configurations for the application.

  This module centralizes all language-related settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """
  @supported_languages [
    en: "English",
    ar: "العربية",
    de: "Deutsch",
    es: "Español",
    fr: "Français",
    hi: "हिन्दी",
    id: "Bahasa Indonesia",
    it: "Italiano",
    ja: "日本語",
    ko: "한국어",
    nl: "Nederlands",
    pl: "Polski",
    pt: "Português",
    ro: "Română",
    ru: "Русский",
    th: "ภาษาไทย",
    tr: "Türkçe",
    vi: "Tiếng Việt",
    zh_Hans: "简体中文",
    zh_Hant: "繁體中文"
  ]

  @languages_map Map.new(@supported_languages, fn {key, value} ->
                   {String.upcase(Atom.to_string(key)), value}
                 end)

  @default_language "en"

  @doc """
  Lists all supported languages.

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

      iex> default_language(:atom)
      :en

      iex> default_language(:string)
      "en"

  """
  def default_language(:atom), do: String.to_existing_atom(@default_language)
  def default_language(:string), do: @default_language

  @doc """
  Returns the name of a language given its code.

  ## Example
      iex> language_name(:en)
      "English"

      iex> language_name("es")
      "Español"

      iex> language_name("PT")
      "Português"

      iex> language_name("Unknown")
      "Unknown Language"

  """
  def language_name(code) when is_binary(code) do
    Map.get(@languages_map, String.upcase(code), "Unknown Language")
  end

  def language_name(code) when is_atom(code) do
    language_name(Atom.to_string(code))
  end
end
