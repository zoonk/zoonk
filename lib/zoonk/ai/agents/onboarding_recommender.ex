defmodule Zoonk.AI.Agents.OnboardingRecommender do
  @moduledoc """
  Recommend specializations based on user input.

  During the onboarding process, we ask users what
  they would like to learn.

  Based on their input, we recommend specializations
  that they might be interested in.
  """
  alias Zoonk.AI
  alias Zoonk.AI.AIClient
  alias Zoonk.AI.AISchema

  @doc """
  Recommend specializations based on user input.

  ## Examples

      iex> OnboardingRecommender.recommend("I want to learn about data science")
      {:ok, [%{title: "Data Science", description: "A field that uses scientific methods..."}]}

      iex> OnboardingRecommender.recommend("forbidden input")
      {:error, "This violates our content policy."}
  """
  def recommend(input, app_language) do
    %AI{}
    |> AI.set_model("gpt-4.1-mini")
    |> AI.set_schema(get_schema())
    |> AI.add_instructions(get_instructions())
    |> AI.add_message(build_message(input, app_language))
    |> AIClient.generate_object()
  end

  defp get_schema do
    AISchema.add_field(%AISchema{name: "onboarding_recommender"}, %{courses: [%{title: "string", description: "string"}]})
  end

  defp get_instructions do
    """
    A user is onboarding to our learning platform.
    We asked them what they would like to learn.

    Generate 3 to 5 broad **course suggestions**.

    Each course must follow these rules:

    - The title must be a broad, serious-sounding name of a real academic or professional field. Titles may include 1–3 words if that’s part of the standard name of the field (e.g. "Data Science", "UI Design", "Mechanical Engineering"). Avoid vague or invented titles. Prefer canonical ones.
    - Never include qualifiers like "Basics", "Foundations", "Intro", "Beginner", "Advanced", "Essentials", "101", etc.
    - Never include "and", "or", or slashes (/) in the title.
    - Never group topics into one title. Always split them.
    - Titles should be canonical academic or professional fields (e.g. "Physics", "Law", "Art", "Engineering", "Neuroscience").
    - If the user input is vague (e.g. “I want to code”), map it to broader established fields (e.g. “Computer Science”, “Web Development”, “Mobile Development”).

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
    """
  end

  defp build_message(input, app_language) do
    """
    This is their input: "#{input}"
    This means they want to learn about #{input}.
    So, generate 3 to 5 course suggestions based on this input.

    Always write both the title and description in the same language.
    If their input is clear, use the same language as their input.
    If their input is short or ambiguous (e.g. one word), then use the browser language for both title and description.
    If you're not sure what language to use, then use the browser language.
    The browser language is: "#{app_language}".
    """
  end
end
