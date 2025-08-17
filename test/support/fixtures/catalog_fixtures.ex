defmodule Zoonk.CatalogFixtures do
  @moduledoc false

  alias Zoonk.AIFixtures

  def course_suggestion_fixture(attrs \\ %{}) do
    title = Map.get(attrs, :title, "Data Science")
    description = Map.get(attrs, :description, "A field that uses scientific methods to analyze data.")
    english_title = Map.get(attrs, :english_title, "Data Science")
    icon = Map.get(attrs, :icon, "tabler-ufo")
    data = %{title: title, description: description, english_title: english_title, icon: icon}

    AIFixtures.openai_stub(%{suggestions: [data]})

    data
  end
end
