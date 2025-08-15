defmodule Zoonk.AI do
  @moduledoc """
  Send requests to AI services.

  This module provides a unified interface for generating
  AI content across various services.
  """
  alias Zoonk.AI.Tasks.SuggestCourses

  @doc """
  Suggest courses based on user input.

  ## Examples

      iex> suggest_courses("I want to learn about data science", "en", "US")
      {:ok, [%{title: "Data Science", description: "A field that uses scientific methods..."}]}

      iex> suggest_courses("forbidden input", "en", "US")
      {:error, "This violates our content policy."}
  """
  defdelegate suggest_courses(input, language, country), to: SuggestCourses
end
