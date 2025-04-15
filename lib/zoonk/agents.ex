defmodule Zoonk.Agents do
  @moduledoc """
  The Agents context.

  This context handles operations related to AI agents and LLM integrations.
  It provides a centralized interface for AI-powered features in the platform.
  """

  alias Zoonk.Agents.CourseSuggestions

  @doc """
  Suggests course names based on user input.
  """
  def suggest_course_names(input, app_language) when is_binary(input) and input != "" do
    Instructor.chat_completion(
      model: "gpt-4.1-nano",
      response_model: CourseSuggestions,
      max_retries: 3,
      messages: [
        %{
          role: "user",
          content: """
          A user is onboarding to a learning platform.
          They typed: "#{input}"

          Generate 3 to 5 broad **course suggestions** in the same language as "#{input}". If ambiguous, use "#{app_language}".

          Each course must follow these rules:

          - The **title** must be short, broad, and serious-sounding — 1 to 2 words, like a real university subject or catalog category.
          - Never include qualifiers like "Basics", "Foundations", "Intro", "Beginner", "Advanced", "Essentials", "101", etc.
          - Never include "and", "or", or slashes (/) in the title.
          - Never group topics into one title. Always split them.
          - Titles should be canonical academic or professional fields (e.g. "Physics", "Law", "Art", "Engineering", "Neuroscience").
          - If the user input is vague (e.g. “I want to code”), map it to broader established fields (e.g. “Computer Science”, “Web Development”, “Mobile Development”).

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

          Now respond with 3 to 5 course titles and descriptions for: "#{input}".
          Remember to use the same language as the one used by them here: "#{input}".
          If the language is ambiguous, use "#{app_language}".
          """
        }
      ]
    )
  end

  def suggest_course_names(_input), do: {:error, :invalid_input}
end
