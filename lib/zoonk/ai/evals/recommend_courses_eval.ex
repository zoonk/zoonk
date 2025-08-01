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
        expectations:
          "Show broad, beginner-friendly programming courses like Computer Science, Software Development, and Web Development as top results. Optional: Mobile Development or Programming Fundamentals. Avoid niche/specialized topics like DevOps, Cybersecurity, or AI at this stage"
      },
      %{
        language: "en",
        input: "How to become a scientist?",
        expectations:
          "Show broad foundational science courses like Biology, Physics, and Chemistry, plus research-focused courses like Scientific Research Methods and Scientific Ethics. Specialized fields (Biomedical Engineering, Neuroscience) can appear later but should not outrank the fundamentals"
      },
      %{
        language: "en",
        input: "Create video games",
        expectations:
          "Include Game Development as the top result, then closely related fields like Game Design, Game Programming, Computer Science, and 3D Design. More specialized areas like Narrative Design or Sound Design should only appear later"
      },
      %{
        language: "pt",
        input: "Quero me tornar um advogado",
        expectations:
          "Include Direito as the top result with require_region: true, followed by key branches like Direito Constitucional, Civil, Penal, and Processual (all require_region: true). Global/general topics like Direitos Humanos and Direito Internacional should be included but flagged require_region: false"
      },
      %{
        language: "es",
        input: "Como ganar seguidores en redes sociales",
        expectations:
          "Show broad, clear titles like Marketing Digital, Estrategias de Redes Sociales, and Creación de Contenido as top results; avoid overly specific or compound names like 'SEO y Marketing de Contenidos' and deprioritize analytical courses (e.g., Análisis de Datos Digitales) for this intent"
      }
    ]
  end

  @impl EvalCase
  def prompt do
    [
      %{
        language: "en",
        input: "I want to learn about painting",
        expectations:
          "Show broad painting-related courses with at least one exact or very close match (e.g., Painting), plus foundational courses like Art Fundamentals and Color Theory. Avoid showing more niche options like Abstract Art or Mural Painting"
      },
      %{
        language: "en",
        input: "I'm curious about the universe",
        expectations:
          "Show broad astronomy-related courses with an accessible entry point like Astronomy, then related courses like Cosmology and Astrophysics. Avoid more advanced or specialized options"
      },
      %{
        language: "en",
        input: "DNA and genetics",
        expectations:
          "User is searching for a specific course, so one of the top results must closely match the input (e.g., DNA and Genetics), followed by related courses like Molecular Biology, Genetics, and Genetic Engineering"
      },
      %{
        language: "en",
        input: "What is the periodic table?",
        expectations:
          "One of the top results must be a dedicated course about the Periodic Table (or a very close match), followed by broader chemistry courses like Chemistry and Elements and Compounds"
      },
      %{
        language: "pt",
        input: "Quero me comunicar melhor",
        expectations:
          "Show practical communication courses like Comunicação Eficaz and Oratória as top results, followed by related skills like Habilidades Interpessoais, Comunicação Não Verbal, and Escuta Ativa"
      },
      %{
        language: "pt",
        input: "kpop",
        expectations:
          "Include an exact or very close match to K-pop (e.g., Cultura K-pop) as a top result, followed by related courses like Música Pop Coreana and Indústria do Entretenimento Coreano. Avoid broader entertainment or business courses"
      },
      %{
        language: "en",
        input: "How to design a website?",
        expectations:
          "Show broad web design-related courses like Web Design, UI Design, UX Design, and Frontend Development as top results, with Web Development as a strong complementary option"
      },
      %{
        language: "en",
        input: "Engineering",
        expectations:
          "Show broad, recognized engineering disciplines such as Mechanical Engineering, Electrical Engineering, Civil Engineering, and other major fields like Chemical, Aerospace, and Computer Engineering"
      },
      %{
        language: "pt",
        input: "Como funcionam os vulcões?",
        expectations:
          "Include Vulcanologia (close match) as a top result, followed by broad geology-related courses like Geologia and Ciências da Terra, with related specialties such as Geofísica and Petrologia as additional options"
      },
      %{
        language: "pt",
        input: "Quero cuidar da minha saúde",
        expectations:
          "Include a broad health and wellness course like Saúde e Bem-Estar (or similar) as a top result, followed by courses on nutrition, physical activity, and mental health (e.g., Nutrição, Educação Física, Saúde Mental)"
      },
      %{
        language: "es",
        input: "Quiero entender la Segunda Guerra Mundial",
        expectations:
          "Include a dedicated course about the Segunda Guerra Mundial (exact/close match) as a top result, followed by broader history courses like Historia Moderna and Historia Contemporánea. Specialized courses (Historia Militar, Relaciones Internacionales) can appear after these"
      },
      %{
        language: "en",
        input: "History",
        expectations:
          "Show broad history-focused courses like World History, Ancient Civilizations, and Modern History as top results, with related specialties (e.g., Archaeology, Art History) appearing only after these"
      },
      %{
        language: "en",
        input: "I want to learn about law",
        expectations:
          "Show Law as the top result with require_region: true, followed by broad law courses like Constitutional Law, Civil Law, and Criminal Justice (all require_region: true), and global/general courses like International Law and Jurisprudence (require_region: false)"
      },
      %{
        language: "pt",
        input: "direito constitucional",
        expectations:
          "Show Direito Constitucional as the top result (require_region: true), followed by closely related courses like Direito Processual Constitucional (require_region: true). Broader or global topics like Direitos Fundamentais, Direito Internacional Público, and Teoria do Estado could be included but flagged require_region: false"
      },
      %{
        language: "es",
        input: "derecho",
        expectations:
          "Show Derecho as top with require_region: true, include core branches (Civil, Penal, Administrativo, Mercantil, Laboral, Tributario) with require_region: true, mark global topics (Derecho Internacional, Derechos Humanos) as require_region: false, and set tech/specialized fields like Derecho Digital to require_region: true"
      },
      %{
        language: "en",
        input: "i suck at math",
        expectations:
          "Include ‘Math’ (exact match) and prioritize foundational/beginner courses (Basic Arithmetic, Pre‑Algebra, Fractions/Decimals) before Algebra/Geometry; exclude advanced/specialized topics from top results"
      },
      %{
        language: "pt",
        input: "Quero entender como funciona a sociedade",
        expectations:
          "Include Sociologia as the top result, followed by Ciências Sociais and Psicologia Social. Complementary fields like Antropologia, História, and Ciência Política (require_region: false) can follow. Country-specific courses like Políticas Públicas should be marked require_region: true and appear lower"
      },
      %{
        language: "en",
        input: "Tech stuff",
        expectations:
          "Show broad core technology courses like Computer Science, Information Technology, and Software Engineering as top results, then related fields like Cybersecurity, Cloud Computing, Artificial Intelligence, and Data Analysis. Avoid overly specific disciplines like Frontend Development or Product Design at the top"
      },
      %{
        language: "en",
        input: "I want to help people",
        expectations:
          "Show Psychology, Counseling, and Mental Health Support as top results; optionally include Social Work and Nursing; do not set require_region for these"
      },
      %{
        language: "pt",
        input: "quero ficar rico",
        expectations:
          "Show broad, practical finance and entrepreneurship courses like Finanças Pessoais, Investimentos, and Empreendedorismo as top results, none requiring require_region: true"
      },
      %{
        language: "en",
        input: "Basics of web and mobile development",
        expectations:
          "Show broad web and mobile development courses like Web Development, Mobile App Development, and Full Stack Development as top results, followed by core subtopics like Frontend and Backend Development"
      },
      %{
        language: "pt",
        input: "Educação Financeira",
        expectations:
          "Include Educação Financeira (exact match) as the top result, followed by Finanças Pessoais, Investimentos, Planejamento Financeiro, and Empreendedorismo; exclude law-specific or overly advanced courses like Direito Financeiro and Engenharia Financeira from top results"
      },
      %{
        language: "pt",
        input: "como funciona o sus",
        expectations:
          "Include Sistema Único de Saúde (SUS) (exact match, require_region: false) as the top result, followed by Políticas de Saúde Pública and Administração em Saúde with require_region: true when content varies by country. Other public health courses should only require region if their content changes significantly by country"
      },
      %{
        language: "pt",
        input: "historia do brasil",
        expectations:
          "Include História do Brasil (exact match) as the top result, followed by other Brazilian history courses (Colonial, Empire, Republic, Contemporary, etc.), all with require_region: false because they are specific to Brazil and their content doesn’t vary by country"
      },
      %{
        language: "en",
        input: "machne leanig",
        expectations:
          "Detect and correct typos in the input, show results in the correct language (English here), and prioritize Machine Learning (exact match) as the top result, followed by Data Science, Artificial Intelligence, and related courses. Avoid overly niche options like Mathematical Optimization as top results"
      },
      %{
        language: "pt",
        input: "coding",
        expectations:
          "Show Portuguese courses even if input is in English. Prioritize Programação (direct match), Desenvolvimento de Software, and Ciência da Computação as top results, then web/mobile development. More specialized areas like IA or Data Science can appear later"
      },
      %{
        language: "es",
        input: "aprender inglés",
        expectations:
          "Show English-learning courses in Spanish (Inglés General, Inglés Conversacional, etc.) and ensure all language-learning and language exam prep courses use category: :language. Non-language courses like Cultura Inglesa or Historia de Inglaterra must not have this category"
      },
      %{
        language: "pt",
        input: "quero falar coreano",
        expectations:
          "Show Korean language-learning courses in Portuguese like Língua Coreana and Fonética e Fluência Coreana with category: :language. Broader cultural courses like Estudos Coreanos must not be marked as language-specific"
      },
      %{
        language: "en",
        input: "frontend",
        expectations:
          "Include Frontend Development (or Frontend Engineering as a synonym) and core topics like HTML, CSS, JavaScript (without extra words like ‘Programming’), and React.js as top results. Web Development is a strong complementary course and could be included. Secondary topics like Accessibility and UI/UX Design can follow"
      },
      %{
        language: "en",
        input: "react",
        expectations:
          "Include React (or React.js) as the top result, plus React Native, JavaScript, and Frontend Development; exclude overly specific subtopics"
      },
      %{
        language: "pt",
        input: "futebol",
        expectations:
          "Include a general Futebol course and Táticas de Futebol and História do Futebol as top results; ensure all englishTitle use Soccer (e.g., Soccer Tactics); list only soccer-related courses, not other sports or general sports courses"
      },
      %{
        language: "en",
        input: "dragon ball",
        expectations:
          "Include Dragon Ball (exact match) as the top result, followed only by tightly related anime courses like Anime Fundamentals, Japanese Animation, and Manga Writing; exclude generic animation or design courses"
      },
      %{
        language: "fr",
        input: "harry potter",
        expectations:
          "Include Harry Potter (exact match) as the top result, followed by tightly related courses like Univers de J.K. Rowling and Littérature Fantastique; exclude broad literary or creative writing courses that are not clearly tied to Harry Potter"
      }
    ]
  end
end
