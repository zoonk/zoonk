defmodule Zoonk.AI.Tasks.SuggestCourses do
  @moduledoc false
  @behaviour Zoonk.AI.Tasks.AITask

  alias Zoonk.AI.AIClient
  alias Zoonk.AI.AIPayload
  alias Zoonk.AI.AISchema
  alias Zoonk.AI.Tasks.AITask
  alias Zoonk.Catalog
  alias Zoonk.Catalog.CourseSuggestion
  alias Zoonk.Helpers
  alias Zoonk.Localization
  alias Zoonk.Locations
  alias Zoonk.Repo
  alias Zoonk.Scope

  def suggest_courses(%Scope{} = scope, attrs) do
    formatted_input = format_input(attrs.input)
    attrs = Map.put(attrs, :input, formatted_input)

    CourseSuggestion
    |> Repo.get_by(query: formatted_input, language: attrs.language)
    |> suggest_courses(scope, attrs)
  end

  defp suggest_courses(%CourseSuggestion{} = course_suggestion, _scope, _attrs) do
    {:ok, course_suggestion}
  end

  defp suggest_courses(nil, scope, attrs) do
    attrs
    |> generate_object(model())
    |> add_suggestion_to_db(scope, attrs)
  end

  defp add_suggestion_to_db({:ok, %{suggestions: suggestions}}, scope, attrs) do
    Catalog.create_course_suggestion(scope, %{query: attrs.input, language: attrs.language, suggestions: suggestions})
  end

  defp add_suggestion_to_db({:error, error}, _scope, _attrs) do
    {:error, error}
  end

  @impl AITask
  def json_schema do
    AISchema.add_field(%AISchema{name: "suggest_courses"}, %{suggestions: [suggestions_schema()]})
  end

  defp suggestions_schema do
    %{
      title: "string",
      description: "string",
      english_title: "string",
      icon: "string",
      is_language_course: "boolean"
    }
  end

  @impl AITask
  def generate_object(attrs) do
    generate_object(attrs, model())
  end

  @impl AITask
  def generate_object(attrs, model) do
    %AIPayload{}
    |> AIPayload.set_model(model)
    |> AIPayload.set_schema(json_schema())
    |> AIPayload.add_instructions(system_prompt())
    |> AIPayload.add_message(user_prompt(attrs))
    |> AIClient.generate_object()
  end

  @impl AITask
  def system_prompt do
    """
    You generate course suggestions from a user input.

    ## Rules

    - Output language: Use the `APP_LANGUAGE` value set by the user for
      both `title` and `description`, no matter what's the language used
      in `USER_INPUT`
    - Always Title Case for `title` and `english_title`
    - Titles must look like real courses; no levels: no "Basics",
      "Beginner", "Advanced", "Intro", "101", "Mastery"
    - No level/variant markers in titles (e.g., ‘101’, ‘Beginner’,
      exam levels like `B1`, or variants like ‘Academic’)
    - Single-topic titles: no "and", "or", "&", "/", commas joining topics
    - For vague inputs, include the broad canonical title itself and related
      courses (e.g., "Computer Science", "Software Engineering", "Web Development")
    - If the input targets a specific topic/IP (e.g., "Black Holes",
      "Periodic Table", "Dragon Ball", "Beatles", "Soccer", "Harry Potter"),
      include that exact topic as ONE suggestion. You may add other broader
      alternatives when appropriate
    - Law topics:
      - Use a specific jurisdiction if provided; otherwise default to `USER_COUNTRY`.
        E.g. "Brazilian Labor Law" for Brazil, "US Constitutional Law" for the US
      - For global law courses like International Law or Human Rights,
        you don't need to set a jurisdiction. But, for other law courses,
        always display the appropriate jurisdiction. **Never** suggest
        a law course without a jurisdiction. For example:
          - Instead of "Labor Law", use "Brazilian Labor Law", "US Labor Law",
            "UK Labor Law", etc
          - Instead of "Constitutional Law", use "Mexican Constitutional Law",
            "Canadian Constitutional Law", "German Constitutional Law", etc
          - Instead of "Law", use "French Law", "Australian Law", "Italian Law", etc.
      - Non-global law suggestions **must** include a jurisdiction:
        use USER_COUNTRY if present; otherwise infer from APP_LANGUAGE
        by offering several plausible jurisdictions for that language community
    - Language learning: if the goal is to learn a language, return EXACTLY ONE
      suggestion with the language name, is_language_course=true
    - Language exams (TOEFL, IELTS, HSK, etc.): return EXACTLY ONE suggestion
      with the exam name, is_language_course=true
    - Do not add extra suggestions for language learning/exams (no writing/culture add-ons).
    - Exam titles: exam family name only; put level/variant details in the description
    - Set is_language_course=true for language acquisition/assessment topics
      (grammar, writing, pronunciation, vocabulary, proficiency exams).
    - Include an `english_title` for each suggestion
    - Standardize english_title to US English spelling
    - Expand acronyms in `english_title` to canonical English where helpful
      (e.g., convert well-known abbreviations to their full English form)
    - `description` should be EXACTLY one sentence
      Highlights why it may be useful or relevant to the learner
    - Add a tabler icon name to illustrate each suggestion.
      Each icon must have a distinct `tabler-` prefix (e.g. `tabler-code`)
    - Generate as many suggestions as you think are relevant, except for
      language courses, which must suggest only the language they want to learn
    """
  end

  @impl AITask
  def user_prompt(%{input: input, language: language, country: country}) do
    """
    - APP_LANGUAGE: #{Localization.language_name(language)}
    - USER_INPUT: #{input}
    - USER_COUNTRY: #{Locations.country_name(country)}
    """
  end

  defp format_input(input) do
    input
    |> String.trim()
    |> Helpers.remove_accents()
  end

  @impl AITask
  def model do
    Application.get_env(:zoonk, :ai_models)[:suggest_courses]
  end
end
