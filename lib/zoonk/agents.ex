defmodule Zoonk.Agents do
  @moduledoc """
  The Agents context.

  This context handles operations related to AI agents and LLM integrations.
  It provides a centralized interface for AI-powered features in the platform.
  """

  alias Zoonk.Agents.CourseSuggestions

  @doc """
  Suggests courses based on user input.
  """
  def suggest_courses(input, app_language) when is_binary(input) and input != "" do
    Instructor.chat_completion(
      model: "gpt-4.1-mini",
      response_model: CourseSuggestions,
      max_retries: 3,
      messages: [
        %{
          role: "user",
          content: """
          A user is onboarding to a learning platform.
          They typed this input: "#{input}"

          Generate 3 to 5 broad **course suggestions** in the same language as this input: "#{input}".
          Always write both the title and description in the same language.
          If the input is clear, use the same language as the input.
          If the input is short or ambiguous (e.g. one word), use "#{app_language}" for both title and description.
          If you're not sure what language to use, then use "#{app_language}".

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

          Now respond with 3 to 5 course titles and descriptions for this input: "#{input}".
          """
        }
      ]
    )
  end

  def suggest_courses(_input), do: {:error, :invalid_input}
end
