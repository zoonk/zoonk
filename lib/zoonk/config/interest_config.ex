defmodule Zoonk.Config.InterestConfig do
  @moduledoc """
  Manages interest configurations for the application.

  This module centralizes all interest category settings used throughout
  the application, ensuring consistency and ease of maintenance.

  ## Interest Categories

  Interests are grouped into categories:

  | Category | Examples |
  |----------|----------|
  | Watch    | Movies, TV shows, documentaries, etc. |
  | Read     | Books, articles, blogs, etc. |
  | Use      | Tools, software, apps, etc. |
  | Listen   | Music, podcasts, audiobooks, etc. |
  | Do       | Hobbies, games, sports, etc. |
  | Play     | Video games, board games, card games, etc. |
  | Other    | Miscellaneous interests that don't fit into the above categories. |
  """

  # styler:sort
  @supported_categories [
    :do,
    :listen,
    :other,
    :play,
    :read,
    :use,
    :watch
  ]

  @doc """
  Lists all supported interest categories.

  ## Example
      iex> list_categories(:atom)
      [:watch, :read, :use, :listen, :do, :play, :other]

      iex> list_categories(:string)
      ["watch", "read", "use", "listen", "do", "play", "other"]

      iex> list_categories(:options)
      [{"Watch", "watch"}, {"Read", "read"}, {"Use", "use"}, ...]
  """
  def list_categories(:atom), do: @supported_categories

  def list_categories(:string), do: Enum.map(@supported_categories, &Atom.to_string/1)

  def list_categories(:options) do
    Enum.map(@supported_categories, fn key ->
      {String.capitalize(Atom.to_string(key)), Atom.to_string(key)}
    end)
  end
end
