defmodule Zoonk.Catalog.Category do
  @moduledoc """
  Manages course category configurations for the application.

  This module centralizes all course category settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """

  # styler:sort
  @supported_categories [
    :astronomy,
    :biology,
    :business,
    :chemistry,
    :communication,
    :culture,
    :design,
    :economics,
    :engineering,
    :exams,
    :geography,
    :health,
    :history,
    :languages,
    :math,
    :physics,
    :society,
    :tech
  ]

  @doc """
  Lists all supported categories.

  ## Example
      iex> list_categories(:atom)
      [:physics, :communication, :history, :astronomy, :chemistry, :tech, :design, :geography, :engineering, :health, :math, :culture, :society, :biology, :economics, :business]

      iex> list_categories(:string)
      ["physics", "communication", "history", "astronomy", "chemistry", "tech", "design", "geography", "engineering", "health", "math", "culture", "society", "biology", "economics", "business"]

      iex> list_categories(:options)
      [{"Physics", "physics"}, {"Communication", "communication"}, {"History", "history"}, ...]
  """
  def list_categories(:atom), do: @supported_categories

  def list_categories(:string), do: Enum.map(@supported_categories, &Atom.to_string/1)

  def list_categories(:options) do
    Enum.map(@supported_categories, fn key -> {key, Atom.to_string(key)} end)
  end
end
