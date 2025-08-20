defmodule Zoonk.CatalogFixtures do
  @moduledoc false

  alias Zoonk.AccountFixtures
  alias Zoonk.AIFixtures
  alias Zoonk.Catalog

  def valid_suggestion(attrs \\ %{}) do
    Enum.into(attrs, %{
      title: "Data Science",
      description: "A field that uses scientific methods to analyze data.",
      english_title: "Data Science",
      icon: "tabler-ufo"
    })
  end

  def valid_course_suggestion_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      query: "data science",
      language: :en,
      suggestions: [valid_suggestion()]
    })
  end

  def course_suggestion_fixture(attrs \\ %{}) do
    scope = Map.get_lazy(attrs, :scope, fn -> AccountFixtures.scope_fixture() end)
    attrs = valid_course_suggestion_attributes(attrs)

    {:ok, course_suggestion} = Catalog.create_course_suggestion(scope, attrs)

    AIFixtures.openai_stub(%{suggestions: attrs.suggestions})

    course_suggestion
  end
end
