defmodule Zoonk.AI.Tasks.SuggestCourses do
  @moduledoc false
  @behaviour Zoonk.AI.Tasks.AITask

  alias Zoonk.AI.AIClient
  alias Zoonk.AI.AIPayload
  alias Zoonk.AI.AISchema
  alias Zoonk.AI.CourseSuggestion
  alias Zoonk.AI.Tasks.AITask
  alias Zoonk.Helpers
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
      icon: "string"
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
    You generate course titles from a short user input.

    ## Rules

    - Output language: Use the `APP_LANGUAGE` value set by the user.
    """
  end

  @impl AITask
  def user_prompt(%{input: input, language: language}) do
    """
    - APP_LANGUAGE: #{language}
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
