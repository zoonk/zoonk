defmodule Zoonk.AI.Tasks.SuggestCourses do
  @moduledoc false
  @behaviour Zoonk.AI.Tasks.AITask

  alias Zoonk.AI.AIClient
  alias Zoonk.AI.AIPayload
  alias Zoonk.AI.AISchema
  alias Zoonk.AI.CourseSuggestion
  alias Zoonk.AI.Tasks.AITask
  alias Zoonk.Helpers
  alias Zoonk.Localization
  alias Zoonk.Repo

  def suggest_courses(input, language) do
    formatted_input = format_input(input)

    CourseSuggestion
    |> Repo.get_by(query: formatted_input, language: language)
    |> suggest_courses(formatted_input, language)
  end

  defp suggest_courses(%CourseSuggestion{} = course_suggestion, _input, _lang) do
    {:ok, %{suggestions: course_suggestion.suggestions}}
  end

  defp suggest_courses(nil, input, language) do
    %{input: input, language: language}
    |> generate_object(model())
    |> add_suggestion_to_db(input, language)
  end

  defp add_suggestion_to_db({:ok, %{suggestions: suggestions} = response}, input, language) do
    %CourseSuggestion{}
    |> CourseSuggestion.changeset(%{query: input, language: language, suggestions: suggestions})
    |> Repo.insert!()

    {:ok, response}
  end

  defp add_suggestion_to_db({:error, error}, _input, _language) do
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
  def generate_object(%{input: input, language: language}, model) do
    %AIPayload{}
    |> AIPayload.set_model(model)
    |> AIPayload.set_schema(json_schema())
    |> AIPayload.add_instructions(system_prompt())
    |> AIPayload.add_message(user_prompt(%{input: input, language: language}))
    |> AIClient.generate_object()
  end

  @impl AITask
  def system_prompt do
    """
    You generate course suggestions from a user input.

    ## Rules

    - Output language: Use the `APP_LANGUAGE` value set by the user.
      No matter what's the language used in the `USER_INPUT`.
    - Titles must look like real courses; no levels: no "Basics",
      "Beginner", "Advanced", "Intro", "101", "Mastery".
    - Single-topic titles: no "and", "or", "&", "/", commas joining topics.
    - For vague inputs, map to broad canonical courses (e.g., "Programming",
      "Computer Science", "Web Development", "Software Engineering").
    - If the input targets a specific topic/IP (e.g., "Black Holes",
      "Periodic Table", "Dragon Ball", "Beatles", "Soccer", "Harry Potter"),
      include that exact topic as ONE suggestion. You may add other broader
      alternatives when appropriate.
    - Law topics:
      - Use a specific jurisdiction if provided; otherwise default to `USER_COUNTRY`.
        E.g. "Brazilian Labor Law" for Brazil, "US Constitutional Law" for the US.
      - For global law courses like International Law or Human Rights,
        you don't need to set a jurisdiction. But, for other law courses,
        always display the appropriate jurisdiction. **Never** suggest
        a law course without a jurisdiction. For example:
          - Instead of "Labor Law", use "Brazilian Labor Law", "US Labor Law",
            "UK Labor Law", etc.
          - Instead of "Constitutional Law", use "Mexican Constitutional Law",
            "Canadian Constitutional Law", "German Constitutional Law", etc.
          - Instead of "Law", use "French Law", "Australian Law", "Italian Law", etc.
      - If the user left `USER_COUNTRY` empty, suggest possible
        jurisdictions based on `APP_LANGUAGE`.
    - Language learning: if the goal is to learn a language, return EXACTLY ONE
      suggestion with the language name, is_language_course=true.
    - Language exams (TOEFL, IELTS, HSK, etc.): return EXACTLY ONE suggestion
      with the exam name, is_language_course=true.
    - Do not add extra suggestions for language learning/exams (no writing/culture add-ons).
    - Include an `english_title` for each suggestion.
    - Include an one-sentence description for each suggestion.
      Highlights why it may be useful or relevant to the learner.
    - Add a tabler icon name to illustrate each suggestion.
      Each icon must have a `tabler-` prefix (e.g. `tabler-code`).
    - Generate as many suggestions as you think are relevant, except for
      language courses, which must suggest only the language they want to learn.
    """
  end

  @impl AITask
  def user_prompt(%{input: input, language: language}) do
    """
    - APP_LANGUAGE: #{Localization.language_name(language)}
    - USER_INPUT: #{input}
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
