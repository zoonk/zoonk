defmodule Zoonk.AI.Evals.SuggestCoursesEval do
  @moduledoc false
  @behaviour Zoonk.AI.Evals.EvalCase

  alias Zoonk.AI.Evals.EvalCase

  require Logger

  @impl EvalCase
  def model do
    [
      %{
        language: "pt",
        country: "BR",
        input: "I want to code",
        expectations:
          """
          - titles should look like these: {"Programação","Ciência da Computação","Desenvolvimento Web","Engenharia de Software"}
          - all titles in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "BR",
        input: "quero aprender sobre buracos negros",
        expectations:
          """
          - suggestions should include {"Black Holes"}
          - suggestions may include broader topics like {"Astrophysics"}
          - all titles in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "es",
        country: "Mexico",
        input: "Derecho Penal",
        expectations:
          """
          - suggestions should include {"Derecho Penal Mexicano"}
          - suggestions may include broader topics like {"Derecho Mexicano"}
          - suggestions may include similar topics like {"Derecho Civil Mexicano", "Derecho Laboral Mexicano"}
          - suggestions should NOT include titles without jurisdiction like {"Derecho Penal", "Derecho"}
          - all titles in Spanish
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "",
        input: "International Law",
        expectations:
          """
          - suggestions should include {"International Law"}
          - all titles in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "pt",
        country: "BR",
        input: "quero passar no toefl",
        expectations:
          """
          - suggestions should include {"TOEFL"}
          - suggestions may include {"Inglês"}
          - all titles in Portuguese
          - `is_language_course` should be true
          - no extra titles like {"Preparatório para o TOEFL", "Redação Acadêmica", "Língua inglesa"}
          """ <> shared_expectations()
      }
    ]
  end

  @impl EvalCase
  def prompt do
    []
  end

  defp shared_expectations do
    """
    - Focus evaluations scores on these fields: `title`, `english_title`, `is_language_course`
    - `english_title` should be the most appropriate English translation of the `title`. For English suggestions, use the same title
    - `description` and `icon` are for aesthetic purposes and should not be the primary focus. Do **NOT** decrease an output's score based on these fields
    - no level/joiner words like "basic", "intermediate", "advanced", "fundamentals", etc
    - <=5 words each title
    - no words like "course", "program", etc in the title
    """
  end
end
