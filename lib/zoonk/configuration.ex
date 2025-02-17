defmodule Zoonk.Configuration do
  @moduledoc """
  This module contains general configuration and constants for the application.
  You can use this module to store configuration that is shared across the application.
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
  Returns the maximum age of a token in days.
  """
  def get_token_max_age_in_days, do: 365

  @doc """
  Returns the maximum age of a token in seconds.
  """
  def get_token_max_age_in_seconds, do: get_token_max_age_in_days() * 24 * 60 * 60

  @doc """
  Returns the validity of a magic link token in minutes.
  """
  def get_magic_link_validity_in_minutes, do: 15

  @doc """
  Returns the validity of a change email token in days.
  """
  def get_change_email_validity_in_days, do: 7

  @doc """
  Returns a list of supported language keys.

  This extracts only the keys from `@supported_languages`,
  which represent the available language options.
  """
  def supported_language_keys do
    Enum.map(@supported_languages, fn {key, _value} -> key end)
  end

  @doc """
  Returns an atom with the default language key.
  """
  def default_language_key, do: String.to_existing_atom(@default_language)

  @doc """
  Returns a string with the default language key.
  """
  def default_language_string, do: @default_language

  @doc """
  Returns a list of language options for a select input.

  Each option is a tuple where the first element is
  the display name of the language, and the second element
  is its key as a string.
  """
  def language_select_options do
    Enum.map(@supported_languages, fn {key, value} -> {value, Atom.to_string(key)} end)
  end
end
