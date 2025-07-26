defmodule Zoonk.AI.Tasks.RecommendCourses do
  @moduledoc false
  alias Zoonk.AI.AIClient
  alias Zoonk.AI.AIPayload
  alias Zoonk.AI.AISchema
  alias Zoonk.AI.CourseRecommendation
  alias Zoonk.Helpers
  alias Zoonk.Repo

  def recommend_courses(input, language) do
    formatted_input = format_input(input)

    CourseRecommendation
    |> Repo.get_by(query: formatted_input, language: language)
    |> recommend_courses(formatted_input, language)
  end

  defp recommend_courses(%CourseRecommendation{} = recommendation, _input, _lang) do
    {:ok, %{courses: recommendation.courses}}
  end

  defp recommend_courses(nil, input, language) do
    input
    |> generate_object(language, get_model())
    |> add_recommendation_to_db(input, language)
  end

  defp add_recommendation_to_db({:ok, %{courses: courses} = response}, input, language) do
    %CourseRecommendation{}
    |> CourseRecommendation.changeset(%{query: input, language: language, courses: courses})
    |> Repo.insert!()

    {:ok, response}
  end

  defp add_recommendation_to_db({:error, error}, _input, _language) do
    {:error, error}
  end

  def json_schema do
    courses = %{
      courses: [
        %{
          title: "string",
          description: "string",
          english_title: "string",
          icon: "string"
        }
      ]
    }

    AISchema.add_field(%AISchema{name: "recommend_courses"}, courses)
  end

  def generate_object(input, language, model) do
    %AIPayload{}
    |> AIPayload.set_model(model)
    |> AIPayload.set_schema(json_schema())
    |> AIPayload.add_instructions(system_prompt())
    |> AIPayload.add_message(user_prompt(input, language))
    |> AIClient.generate_object()
  end

  def system_prompt do
    """
    A user wants to learn a new subject.
    We asked them what they would like to learn.

    Generate 3 to 10 broad **course suggestions**.

    Each course must follow these rules:

    - The title must be a broad, serious-sounding name of a real academic or professional field. Titles may include 1–3 words if that’s part of the standard name of the field (e.g. "Data Science", "UI Design", "Mechanical Engineering"). Avoid vague or invented titles. Prefer canonical ones.
    - Never include qualifiers like "Basics", "Foundations", "Intro", "Beginner", "Advanced", "Essentials", "101", etc.
    - Never include "and", "or", or slashes (/) in the title.
    - Never group topics into one title. Always split them.
    - Titles should be canonical academic or professional fields (e.g. "Physics", "Law", "Art", "Engineering", "Neuroscience").
    - If the user input is vague (e.g. “I want to code”), map it to broader established fields (e.g. “Computer Science”, “Web Development”, “Mobile Development”).
    - Each course must also include an `english_title` field that is a string representing the `title` in English.

    Examples of valid course titles:
    - Computer Science
    - Data Science
    - UI Design
    - UX Design
    - Mechanical Engineering
    - Electrical Engineering
    - Cognitive Psychology
    - Artificial Intelligence

    If the user input is already a valid or common course name (e.g. "Educação Financeira", "Digital Transformation", "Leadership"), include it as one of the suggestions — ideally the first.
    Do not replace it with more academic fields unless the original term is too vague or nonstandard.
    If the input closely resembles a good course title, include a suggestion using the same or very similar title.

    Each course must also include a 1-sentence description that:
    - Clearly explains what the course covers.
    - Highlights why it may be useful or relevant to the user.

    Examples:

    Input: I want to build mobile apps
    Output:
    - Mobile Development – Learn how to create apps for iOS and Android using tools like Swift, Kotlin, and Flutter.
    - UI Design – Explore how to design intuitive and responsive mobile interfaces.
    - Computer Science – Understand the foundational concepts behind software and app development.

    Input: Quero aprender a desenhar personagens
    Output:
    - Ilustração Digital – Aprenda a desenhar personagens usando ferramentas como o Procreate e o Photoshop.
    - Design de Personagens – Descubra como criar personagens únicos, com estilo e personalidade.
    - Anatomia Artística – Entenda proporções e movimento para criar figuras humanas mais realistas.

    Each course must also have an `icon` field with a tabler icon to illustrate this course. For example:
    - Computer Science – icon: "tabler-code"
    - Data Science – icon: "tabler-chart-pie"
    - UI Design – icon: "tabler-palette"

    Always add the `tabler-` prefix to the icon name.
    """
  end

  def user_prompt(input, language) do
    """
    This is their input: "#{input}"
    This means they want to learn about #{input}.
    So, generate 3 to 10 course suggestions based on this input.

    Write both the `title` and `description` fields in the same language.
    They want to see results in this language: #{language}.
    If it's not English, translate the title and add it to the `english_title` field.
    """
  end

  defp format_input(input) do
    input
    |> String.trim()
    |> Helpers.remove_accents()
  end

  defp get_model do
    Application.get_env(:zoonk, :ai_models)[:recommend_courses]
  end
end
