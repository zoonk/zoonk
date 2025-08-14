defmodule Zoonk.AI.Evals.RecommendCoursesEval do
  @moduledoc false
  @behaviour Zoonk.AI.Evals.EvalCase

  alias Zoonk.AI.Evals.EvalCase

  require Logger

  @impl EvalCase
  def model do
    [
      %{
        language: "en",
        input: "I want to learn programming",
        expectations: ""
      },
      %{
        language: "en",
        input: "How to become a scientist?",
        expectations: ""
      },
      %{
        language: "en",
        input: "TOEFL",
        expectations:
          "Set category as `language` for language courses or proficiency tests. If adding non `language` courses, then they should not have a `language` category."
      },
      %{
        language: "pt",
        input: "Quero me tornar um advogado",
        expectations:
          "User speaks Portuguese. Include courses like `Direito Brasileiro` and `Direito Português`. Don't show only `Direito` without specifying the region."
      },
      %{
        language: "es",
        input: "Como ganar seguidores en redes sociales",
        expectations: "User speaks Spanish"
      }
    ]
  end

  @impl EvalCase
  def prompt do
    [
      %{
        language: "en",
        input: "I'm curious about the universe",
        expectations: ""
      },
      %{
        language: "en",
        input: "DNA and genetics",
        expectations:
          "This is a specific topic, so the top result should be a course directly related to DNA and genetics, not something broader like Biology or Life Sciences."
      },
      %{
        language: "en",
        input: "What is the periodic table?",
        expectations:
          "This is a specific chemistry topic, so the top result should be a course directly related to the periodic table, not something broader like Chemistry or Science."
      },
      %{
        language: "pt",
        input: "Quero me comunicar melhor",
        expectations: "User speaks Portuguese"
      },
      %{
        language: "pt",
        input: "kpop",
        expectations:
          "User speaks Portuguese. Include something directly related to K-Pop as the top result since the user is specific about this interest. Broader topics like Korean Culture or Music can follow, but K-Pop should be prioritized."
      },
      %{
        language: "en",
        input: "Engineering",
        expectations: ""
      },
      %{
        language: "es",
        input: "Quiero entender la Segunda Guerra Mundial",
        expectations:
          "User speaks Spanish. Include a course specifically about World War II as the top result since the user is specific about this interest. Broader history courses can follow, but World War II should be prioritized."
      },
      %{
        language: "en",
        input: "History",
        expectations: ""
      },
      %{
        language: "en",
        input: "I want to learn about law",
        expectations:
          "Show courses like US Law and/or UK Law as top results. All courses should be specific to the user's region, except general law courses like International Law or Human Rights. Don't show a generic `Law` course without specifying the region."
      },
      %{
        language: "pt",
        input: "direito constitucional",
        expectations:
          "User speaks Portuguese. Show courses like Direito Constitucional Brasileiro and/or Direito Constitucional Português as top results. All courses should be specific to the user's region, except general law courses like Direitos Humanos or Direito Internacional. Don't show a generic `Direito Constitucional` course without specifying the region."
      },
      %{
        language: "pt",
        input: "direito brasileiro",
        expectations:
          "User speaks Portuguese. Show courses like Direito Brasileiro as top results. All courses should be specific to the user's region, except general law courses like Direitos Humanos or Direito Internacional. Don't show a generic `Direito` course without specifying the region."
      },
      %{
        language: "es",
        input: "derecho",
        expectations:
          "User speaks Spanish. Show courses like Derecho Español or similar as top results. Don't show a generic `Derecho` course without specifying the region, except for global topics like Derechos Humanos or Derecho Internacional."
      },
      %{
        language: "en",
        input: "i suck at math",
        expectations: ""
      },
      %{
        language: "en",
        input: "Tech stuff",
        expectations: ""
      },
      %{
        language: "pt",
        input: "quero ficar rico",
        expectations: "User speaks Portuguese"
      },
      %{
        language: "pt",
        input: "Educação Financeira",
        expectations:
          "User speaks Portuguese. Make sure a course related to financial education is the top result since the user is specific about this interest."
      },
      %{
        language: "pt",
        input: "historia do brasil",
        expectations:
          "User speaks Portuguese. Include História do Brasil (exact match) as the top result since the user is specific about this interest. Broader Brazilian history or Latin American history courses can follow, but História do Brasil should be prioritized."
      },
      %{
        language: "en",
        input: "machne leanig",
        expectations:
          "Detect and correct typos from the input, show results in the correct language (English here), and prioritize Machine Learning (exact match) as the top result"
      },
      %{
        language: "pt",
        input: "coding",
        expectations:
          "Show courses in Portuguese since that's the user-defined language, even though the input is in English"
      },
      %{
        language: "es",
        input: "aprender inglés",
        expectations:
          "Show English-learning courses in Spanish and ensure all language-learning and language exam prep courses use category: `language`. It's okay to have non-language courses like Cultura Inglesa or Historia de Inglaterra but they must not be in the `language` category."
      },
      %{
        language: "pt",
        input: "quero falar coreano",
        expectations:
          "Show Korean-learning courses in Portuguese and ensure all language-learning and language exam prep courses use category: `language`. It's okay to have non-language courses like Cultura Coreana or História da Coreia, but they must not be in the `language` category."
      },
      %{
        language: "en",
        input: "frontend",
        expectations: "It should have a frontend course as the top result since the user is specific about this interest"
      },
      %{
        language: "pt",
        input: "futebol",
        expectations:
          "User speaks Portuguese. It should include soccer related courses; ensure all englishTitle use Soccer (e.g., Soccer Tactics); list only soccer-related courses, not other sports or general sports courses"
      },
      %{
        language: "en",
        input: "dragon ball",
        expectations:
          "Dragon Ball should be the top result (exact match) since the user is specific about this interest. Broader anime or manga courses can follow, but Dragon Ball should be prioritized."
      },
      %{
        language: "fr",
        input: "harry potter",
        expectations:
          "User speaks French. Harry Potter should be the top result (exact match) since the user is specific about this interest. Broader fantasy or literature courses can follow, but Harry Potter should be prioritized."
      },
      %{
        language: "en",
        input: "black holes",
        expectations:
          "A suggestion about black holes should be the top result (exact match) since the user is specific about this interest. Broader astrophysics or space courses can follow, but Black Holes should be prioritized."
      }
    ]
  end
end
