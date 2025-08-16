defmodule Zoonk.AI.Evals.SuggestCoursesEval do
  @moduledoc false
  @behaviour Zoonk.AI.Evals.EvalCase

  alias Zoonk.AI.Evals.EvalCase

  require Logger

  @impl EvalCase
  def cases do
    [
      %{
        language: "pt",
        country: "US",
        input: "I want to code",
        expectations:
          """
          - titles should look like these: {"Programação","Ciência da Computação","Desenvolvimento Web","Engenharia de Software"}
          - all titles and descriptions in Portuguese
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
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "es",
        country: "MX",
        input: "Derecho Penal",
        expectations:
          """
          - suggestions should include {"Derecho Penal Mexicano"}
          - suggestions may include broader topics like {"Derecho Mexicano"}
          - suggestions may include similar topics like {"Derecho Civil Mexicano", "Derecho Laboral Mexicano"}
          - suggestions should NOT include titles without jurisdiction like {"Derecho Penal", "Derecho"}
          - all titles and descriptions in Spanish
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
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "pt",
        country: "PT",
        input: "quero passar no toefl",
        expectations:
          """
          - suggestions should include {"TOEFL"}
          - suggestions may include {"Inglês"}
          - all titles and descriptions in Portuguese
          - `is_language_course` should be true
          - no extra titles like {"Preparatório para o TOEFL", "Redação Acadêmica", "Língua inglesa"}
          """ <> shared_expectations()
      },
      %{
        language: "pt",
        country: "",
        input: "physics and chemistry",
        expectations:
          """
          - suggestions should include both "Física" and "Química"
          - should NOT include "Física e Química" as a single title
          - may include broader or similar topics
          - all titles and descriptions in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "",
        input: "intro to chemistry",
        expectations:
          """
          - suggestions should include "Chemistry" (without "Intro")
          - do NOT include "Intro to Chemistry"
          - may include broader or similar topics
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "BR",
        input: "direito do trabalho",
        expectations:
          """
          - suggestions should include "Brazilian Labor Law" (in English but with Brazilian jurisdiction)
          - optionally, may include other law suggestions in the Brazilian jurisdiction
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "pt",
        country: "BR",
        input: "us constitutional law",
        expectations:
          """
          - suggestions should include "Direito Constitucional dos EUA" (or equivalent title in Portuguese)
          - optionally, may include other law suggestions in the US jurisdiction
          - all titles and descriptions in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "pt",
        country: "BR",
        input: "international human rights",
        expectations:
          """
          - suggestions should include "Direitos Humanos" or "Direitos Humanos Internacionais" without a jurisdiction
          - optionally, may include other similar global law courses or law courses under Brazilian jurisdiction
          - all titles and descriptions in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "DE",
        input: "gdpr",
        expectations:
          """
          - suggestions should include "GDPR"
          - it could include similar suggestions like "EU Data Protection Law" and/or other data protection laws in the European context
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "pt",
        country: "",
        input: "dragon ball",
        expectations:
          """
          - suggestions should include "Dragon Ball"
          - optionally, may include broader alts like "Animação", "Cultura Pop" or related suggestions
          - all titles and descriptions in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "",
        input: "beatles",
        expectations:
          """
          - suggestions should include "Beatles" or "The Beatles"
          - optionally, may include broader alts like "Rock", "Music History" or related suggestions
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "fr",
        country: "",
        input: "f1",
        expectations:
          """
          - suggestions should include "Formule 1" or "F1"
          - optionally, may include broader alts like "Sports", "Auto Racing" or related suggestions
          - all titles and descriptions in French
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        language: "pt",
        country: "",
        input: "quero aprender ingles e espanhol",
        expectations:
          """
          - suggestions should include either "Inglês" or "Espanhol" or both
          - should NOT include any other suggestions
          - all titles and descriptions in Portuguese
          - `is_language_course` should be true
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "",
        input: "jlpt n2",
        expectations:
          """
          - suggestions should include "JLPT" without the "N2" level suffix
          - optionally, may include "Japanese"
          - should NOT include any other suggestions
          - all titles and descriptions in English
          - `is_language_course` should be true
          """ <> shared_expectations()
      },
      %{
        language: "en",
        country: "GB",
        input: "california employment law",
        expectations:
          """
          - suggestions should include "California Employment Law"
          - optionally, may include other California-related laws or regulations
          - should NOT include a generic "Employment Law" suggestion without a jurisdiction
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "quero passar no IELTS Academic",
        language: "pt",
        country: "",
        expectations:
          """
          - suggestions should include "IELTS", strip "Academic" suffix
          - optionally, may include "English"
          - should NOT include any other suggestions
          - all titles and descriptions in Portuguese
          - `is_language_course` should be true
          """ <> shared_expectations()
      },
      %{
        input: "how computers work?",
        language: "en",
        country: "MX",
        expectations:
          """
          - suggestions should include broad caninocals like (but not limited to) "Computer Science", "Computer Architecture", "Operating Systems"
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "quero aprender a programar sites e apps",
        language: "pt",
        country: "US",
        expectations:
          """
          - suggestions should include single topics such as "Desenvolvimento Web", "Desenvolvimento Mobile" (but not limited to those, similar ones are fine)
          - should NOT include joined titles like "Sites e Apps"
          - all titles and descriptions in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "constitutional law basics",
        country: "GB",
        language: "en",
        expectations:
          """
          - suggestions should include "UK Constitutional Law" or similar like "British Constitutional Law" or "United Kingdom Constitutional Law"
          - may include other law courses in the UK jurisdiction
          - should NOT include law courses without a jurisdiction
          - should NOT use the other "basics" or similar terms
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "periodic table",
        country: "US",
        language: "pt",
        expectations:
          """
          - suggestions should include "Tabela Periódica"
          - may include other chemistry-related topics and broad suggestions like "Química"
          - all titles and descriptions in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "the matrix",
        country: "FR",
        language: "en",
        expectations:
          """
          - suggestions should include "The Matrix" (the movie)
          - may include broader film-related suggestions like "Film Studies"
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "pyhsics",
        country: "AR",
        language: "en",
        expectations:
          """
          - suggestions should include "Physics"
          - may include other physics-related topics
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "direito do trabalho",
        country: "",
        language: "pt",
        expectations:
          """
          - suggestions should include labor law courses with jurisdictions of Portuguese-speaking countries like "Direito do Trabalho Brasileiro", "Direito do Trabalho Português", etc.
          - all titles and descriptions in Portuguese
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "literature",
        country: "",
        language: "en",
        expectations:
          """
          - suggestions should include "Literature"
          - may include other literature-related suggestions
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "grammar",
        country: "",
        language: "en",
        expectations:
          """
          - suggestions should include "English Grammar"
          - may include other grammar-related suggestions
          - all titles and descriptions in English
          - `is_language_course` should be true
          """ <> shared_expectations()
      },
      %{
        input: "harry potter",
        country: "",
        language: "en",
        expectations:
          """
          - suggestions should include "Harry Potter"
          - may include other literature-related suggestions
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "programming languages",
        country: "",
        language: "en",
        expectations:
          """
          - suggestions should include "Programming Languages"
          - may include other programming-related suggestions and/or specific programming languages
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "python",
        country: "",
        language: "en",
        expectations:
          """
          - suggestions should include "Python"
          - may include other Python-related suggestions
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      },
      %{
        input: "got",
        country: "",
        language: "en",
        expectations:
          """
          - suggestions should include "Game of Thrones"
          - may include other literature-related suggestions
          - all titles and descriptions in English
          - `is_language_course` should be false
          """ <> shared_expectations()
      }
    ]
  end

  defp shared_expectations do
    """
    - Focus evaluations scores on these fields: `title`, `english_title`, `is_language_course`
    - `english_title` should be the most appropriate English translation of the `title`. For English suggestions, use the same title
    - `icon` should start with `tabler`, don't worry if it's a valid icon or not
    - don't need to evaluate the `description` field content, just check the language is correct
    - no level/joiner words like "basic", "intermediate", "advanced", "fundamentals", etc
    - no words like "course" in the title
    - titles are always in Title Case
    """
  end
end
