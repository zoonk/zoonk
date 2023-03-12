defmodule Zoonk.Language do
  @moduledoc """
  Reusable functions for setting up multiple languages and translations.
  """

  @supported_languages [en: "English", pt: "Português"]

  @doc """
  List keys and labels for supported languages.
  """
  def supported_languages, do: @supported_languages

  @doc """
  List all keys for supported languages.
  """
  def supported_languages_keys do
    Enum.map(@supported_languages, fn {key, _value} -> key end)
  end

  @doc """
  Language options for displaying on a `select` component where the label is the key and the key is the value.
  """
  def language_options do
    Enum.map(@supported_languages, fn {key, value} -> {value, key} end)
  end
end
