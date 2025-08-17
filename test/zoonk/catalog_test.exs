defmodule Zoonk.CatalogTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Catalog
  alias Zoonk.Catalog.CourseSuggestion

  describe "create_course_suggestion/1" do
    test "creates a course suggestion with valid attrs" do
      scope = scope_fixture()

      attrs = %{
        "query" => "data science",
        "language" => :en,
        "suggestions" => [
          %{"title" => "Data Science", "description" => "Learn data analysis", "english_title" => "Data Science"}
        ]
      }

      assert {:ok, %CourseSuggestion{} = course_suggestion} = Catalog.create_course_suggestion(scope, attrs)
      assert is_integer(course_suggestion.content_id)
      assert course_suggestion.query == "data science"
      assert course_suggestion.language == :en
      [suggestion] = course_suggestion.suggestions
      assert suggestion.title == "Data Science"
      assert suggestion.description == "Learn data analysis"
    end

    test "returns error changeset when required fields missing" do
      scope = scope_fixture()
      assert {:error, changeset} = Catalog.create_course_suggestion(scope, %{"suggestions" => []})
      assert "can't be blank" in errors_on(changeset).query
    end
  end
end
