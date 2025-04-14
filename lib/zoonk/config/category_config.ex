defmodule Zoonk.Config.CategoryConfig do
  @moduledoc """
  Manages course category configurations for the application.

  This module centralizes all course category settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """
  use Gettext, backend: Zoonk.Gettext

  # styler:sort
  @supported_categories [
    astronomy: gettext("Astronomy"),
    biology: gettext("Biology"),
    business: gettext("Business"),
    chemistry: gettext("Chemistry"),
    communication: gettext("Communication"),
    culture: gettext("Culture"),
    design: gettext("Design"),
    economics: gettext("Economics"),
    engineering: gettext("Engineering"),
    geography: gettext("Geography"),
    health: gettext("Health"),
    history: gettext("History"),
    math: gettext("Math"),
    physics: gettext("Physics"),
    society: gettext("Society"),
    tech: gettext("Tech")
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
  def list_categories(:atom) do
    Enum.map(@supported_categories, fn {key, _value} -> key end)
  end

  def list_categories(:string) do
    Enum.map(@supported_categories, fn {key, _value} -> Atom.to_string(key) end)
  end

  def list_categories(:options) do
    Enum.map(@supported_categories, fn {key, value} -> {value, Atom.to_string(key)} end)
  end
end
