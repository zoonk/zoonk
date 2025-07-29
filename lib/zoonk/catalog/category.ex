defmodule Zoonk.Catalog.Category do
  @moduledoc """
  Manages course category configurations for the application.

  This module centralizes all course category settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """

  # styler:sort
  @supported_categories [
    :arts,
    :business,
    :communication,
    :culture,
    :economics,
    :education,
    :engineering,
    :exams,
    :geography,
    :health,
    :history,
    :languages,
    :law,
    :math,
    :science,
    :society,
    :tech
  ]

  @doc """
  Lists all supported categories.

  ## Example
      iex> list_categories(:atom)
      [:arts, ...]

      iex> list_categories(:string)
      ["arts", ...]

      iex> list_categories(:options)
      [{"Arts", "arts"}, ...]
  """
  def list_categories(:atom), do: @supported_categories

  def list_categories(:string), do: Enum.map(@supported_categories, &Atom.to_string/1)

  def list_categories(:options) do
    Enum.map(@supported_categories, fn key -> {key, Atom.to_string(key)} end)
  end
end
