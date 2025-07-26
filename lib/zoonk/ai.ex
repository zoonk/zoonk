defmodule Zoonk.AI do
  @moduledoc """
  Send requests to AI services.

  This module provides a unified interface for generating
  AI content across various services.
  """
  alias Zoonk.AI.Tasks.RecommendCourses

  @doc """
  Recommend courses based on user input.

  ## Examples

      iex> recommend_courses("I want to learn about data science", "en")
      {:ok, [%{title: "Data Science", description: "A field that uses scientific methods..."}]}

      iex> recommend_courses("forbidden input", "en")
      {:error, "This violates our content policy."}
  """
  defdelegate recommend_courses(input, language), to: RecommendCourses
end
