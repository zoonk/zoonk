defmodule Zoonk.Agents do
  @moduledoc """
  The Agents context.

  This context handles operations related to AI agents and LLM integrations.
  It provides a centralized interface for AI-powered features in the platform.
  """

  alias Zoonk.Agents.CourseNameSuggestion

  @doc """
  Suggests course names based on user input.

  Returns a list of 2-10 course name suggestions in the same language as the input.

  ## Examples

      iex> suggest_course_names("How to program in Python")
      {:ok, %{suggestions: ["Introduction to Python Programming", "Python for Beginners", "Learn Python Basics"], language: "en"}}

      iex> suggest_course_names("Como hacer pan casero")
      {:ok, %{suggestions: ["Panadería Casera para Principiantes", "El Arte del Pan Casero", "Técnicas de Panadería"], language: "es"}}

      iex> suggest_course_names(123)
      {:error, :invalid_input}
  """
  def suggest_course_names(input) when is_binary(input) and input != "" do
    Instructor.chat_completion(
      model: "gpt-4.1-nano",
      response_model: CourseNameSuggestion,
      max_retries: 2,
      messages: [
        %{
          role: "system",
          content: """
          You are an AI specialized in suggesting course names for an educational platform.
          Users will input topics or interests in various languages, and your task is to:

          1. Detect the language being used in the input
          2. Suggest 2-10 appropriate and short course names in that SAME language
          3. Return the language code (ISO 639-1) in the response

          Keep each course name concise but descriptive (2-6 words is ideal).
          The course names should be educational, appropriate for all ages, and varied in style to give users multiple options.

          For example:

          - Input: "learn to code"
            Output: ["Computer Science", "Python", "Web Development", "Data Science", "AI Basics"]

          - Input: Quero aprender a cozinhar
            Output: ["Gastronomia", "Cozinha Brasileira", "Culinária Internacional"]

          - Input: "physics"
            Output: ["Physics", "Quantum Mechanics", "Astrophysics", "Thermodynamics"]

          If the input is offensive, inappropriate, or not suitable for educational purposes, then
          return an empty list of suggestions and the language code.
          """
        },
        %{
          role: "user",
          content: "This is the user input: #{input}. Now please suggest course names."
        }
      ]
    )
  end

  def suggest_course_names(_input), do: {:error, :invalid_input}
end
