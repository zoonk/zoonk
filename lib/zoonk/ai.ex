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

      iex> suggest_courses(%Scope{}, attrs)
      {:ok, [%{title: "Data Science", description: "A field that uses scientific methods..."}]}

      iex> suggest_courses(%Scope{}, attrs)
      {:error, "This violates our content policy."}
  """
  defdelegate suggest_courses(scope, attrs), to: SuggestCourses
end
