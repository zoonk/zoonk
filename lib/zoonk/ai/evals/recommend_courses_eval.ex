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
        input: "Create video games",
        expectations: ""
      },
      %{
        language: "pt",
        input: "Quero me tornar um advogado",
        expectations:
          "User speaks Portuguese. Include Direito as the top result with require_region: true. If global/general topics like Direitos Humanos and Direito Internacional are included, they should be marked require_region: false."
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
        input: "I want to learn about painting",
        expectations: ""
      },
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
        input: "How to design a website?",
        expectations: ""
      },
      %{
        language: "en",
        input: "Engineering",
        expectations: ""
      },
      %{
        language: "pt",
        input: "Como funcionam os vulcões?",
        expectations:
          "User speaks Portuguese. Include a course specifically about volcanoes as the top result, followed by broader geology or earth science courses."
      },
      %{
        language: "pt",
        input: "Quero cuidar da minha saúde",
        expectations: "User speaks Portuguese."
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
          "Show Law as the top result with require_region: true. If global/general topics like Human Rights and International Law are included, they should be marked require_region: false."
      },
      %{
        language: "pt",
        input: "direito constitucional",
        expectations:
          "User speaks Portuguese. Show Direito Constitucional as the top result (require_region: true). If global topics like Direitos Humanos or Direito Internacional are included, they should be marked require_region: false."
      },
      %{
        language: "es",
        input: "derecho",
        expectations:
          "User speaks Spanish. Show Derecho as the top result with require_region: true. If global/general topics like Derechos Humanos and Derecho Internacional are included, they should be marked require_region: false."
      },
      %{
        language: "en",
        input: "i suck at math",
        expectations: ""
      },
      %{
        language: "pt",
        input: "Quero entender como funciona a sociedade",
        expectations: "User speaks Portuguese"
      },
      %{
        language: "en",
        input: "Tech stuff",
        expectations: ""
      },
      %{
        language: "en",
        input: "I want to help people",
        expectations: ""
      },
      %{
        language: "pt",
        input: "quero ficar rico",
        expectations: "User speaks Portuguese"
      },
      %{
        language: "en",
        input: "Basics of web and mobile development",
        expectations: ""
      },
      %{
        language: "pt",
        input: "Educação Financeira",
        expectations:
          "User speaks Portuguese. Make sure a course related to financial education is the top result since the user is specific about this interest."
      },
      %{
        language: "pt",
        input: "como funciona o sus",
        expectations:
          "User speaks Portuguese. Include Sistema Único de Saúde (SUS) (exact match, require_region: false) as the top result since the user is specific about this interest. Broader health or public health courses can follow, but SUS should be prioritized."
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
          "Show English-learning courses in Spanish and ensure all language-learning and language exam prep courses use category: :language. It's okay to have non-language courses like Cultura Inglesa or Historia de Inglaterra but they must not be in the `language` category."
      },
      %{
        language: "pt",
        input: "quero falar coreano",
        expectations:
          "Show Korean-learning courses in Portuguese and ensure all language-learning and language exam prep courses use category: :language. It's okay to have non-language courses like Cultura Coreana or História da Coreia, but they must not be in the `language` category."
      },
      %{
        language: "en",
        input: "frontend",
        expectations: "It should have a frontend course as the top result since the user is specific about this interest"
      },
      %{
        language: "en",
        input: "react",
        expectations: "It should have a React course as the top result since the user is specific about this interest"
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
      }
    ]
  end
end
