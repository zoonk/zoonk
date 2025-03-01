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

  @default_language "en"

  @doc group: "Authentication"
  @doc """
  Returns the default hash algorithm.
  """
  def get_hash_algorithm, do: :sha256

  @doc group: "Authentication"
  @doc """
  Returns the maximum age of a token.

  ## Example

      iex> get_token_max_age(:days)
      365

      iex> get_token_max_age(:seconds)
      31536000
  """
  def get_token_max_age(:days), do: 365
  def get_token_max_age(:seconds), do: get_token_max_age(:days) * 24 * 60 * 60

  @doc group: "Authentication"
  @doc """
  Returns the validity of a magic link token in minutes.

  It is very important to keep the magic link token expiry short,
  since someone with access to the email may take over the account.
  """
  def get_magic_link_validity_in_minutes, do: 15

  @doc group: "Authentication"
  @doc """
  Returns the validity of a change email token in days.
  """
  def get_change_email_validity_in_days, do: 7

  @doc group: "Authentication"
  @doc """
  Returns the name of the remember me cookie.
  """
  def get_remember_me_cookie_name, do: "_zoonk_web_user_remember_me"

  @doc group: "Authentication"
  @doc """
  Returns a list of supported oAuth providers.
  """
  def list_supported_oauth_providers, do: [:apple, :github, :google, :microsoft]

  @doc group: "Language"
  @doc """
  Returns a list of supported language keys.

  ## Example

      iex> list_language_keys(:atom)
      [:en, :de, :es, :fr, :it, :ja, :ko, :pt, :tr, :zh_Hans, :zh_Hant]

      iex> list_language_keys(:string)
      ["en", "de", "es", "fr", "it", "ja", "ko", "pt", "tr", "zh_Hans", "zh_Hant"]
  """
  def list_language_keys(:atom) do
    Enum.map(@supported_languages, fn {key, _value} -> key end)
  end

  def list_language_keys(:string) do
    Enum.map(@supported_languages, fn {key, _value} -> Atom.to_string(key) end)
  end

  @doc group: "Language"
  @doc """
  Returns an atom with the default language key.

  ## Example

      iex> default_language_key()
      :en
  """
  def default_language_key, do: String.to_existing_atom(@default_language)

  @doc group: "Language"
  @doc """
  Returns a string with the default language key.

  ## Example

      iex> default_language_string()
      "en"
  """
  def default_language_string, do: @default_language

  @doc group: "Language"
  @doc """
  Returns a list of language options for a select input.

  Each option is a tuple where the first element is
  the display name of the language, and the second element
  is its key as a string.

  ## Example

      iex> language_select_options()
      [{"English", "en"}, {"Deutsch", "de"}, ...]
  """
  def language_select_options do
    Enum.map(@supported_languages, fn {key, value} -> {value, Atom.to_string(key)} end)
  end
end
