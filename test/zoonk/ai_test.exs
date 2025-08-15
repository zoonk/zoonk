defmodule Zoonk.AITest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI
  alias Zoonk.AI.CourseSuggestion
  alias Zoonk.Repo

  describe "suggest_courses/2" do
    test "returns a suggestion from the AI" do
      input = "I want to learn about data science"
      title = "Data Science"
      description = "A field that uses scientific methods to analyze data."
      english_title = "Data Science"

      openai_stub(%{suggestions: [%{title: title, description: description, english_title: english_title}]})

      assert {:ok, course_suggestions} = AI.suggest_courses(input, :en, "US")
      suggestion = hd(course_suggestions.suggestions)
      assert suggestion.title == title
      assert suggestion.description == description
    end

    test "fetches data from cache when existing" do
      suggestions = [
        %{
          title: "Computer Science",
          description: "A field that studies the theory and practice of computing.",
          english_title: "Computer Science"
        }
      ]

      suggestion = hd(suggestions)
      query = String.downcase(suggestion.title)

      Repo.insert!(%CourseSuggestion{
        query: query,
        language: :en,
        suggestions: suggestions
      })

      assert {:ok, cached_suggestions} = AI.suggest_courses(query, :en, "US")

      cached_suggestion = hd(cached_suggestions.suggestions)
      assert cached_suggestion.title == suggestion.title
      assert cached_suggestion.description == suggestion.description
    end

    test "adds suggestions to the database" do
      input = "great course"
      title = "Great Course"
      description = "A field that uses scientific methods to analyze data."

      openai_stub(%{suggestions: [%{title: title, description: description, english_title: "Great Course"}]})

      assert {:ok, _suggestions} = AI.suggest_courses(input, :en, "US")

      course_suggestion = Repo.get_by(CourseSuggestion, query: input, language: :en)
      suggestion = hd(course_suggestion.suggestions)
      assert suggestion.title == title
      assert suggestion.description == description
    end
  end
end
