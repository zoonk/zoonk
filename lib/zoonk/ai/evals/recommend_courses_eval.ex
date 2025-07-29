defmodule Zoonk.AI.Evals.RecommendCoursesEval do
  @moduledoc false
  @behaviour Zoonk.AI.Evals.EvalTask

  alias Zoonk.AI.Evals.EvalTask
  alias Zoonk.AI.Tasks.RecommendCourses

  require Logger

  @impl EvalTask
  def generate_object(model, attrs) do
    RecommendCourses.generate_object(attrs, model)
  end

  @impl EvalTask
  def model_cases do
    [
      %{language: "en", input: "I want to learn programming"},
      %{language: "en", input: "How to become a scientist?"},
      %{language: "en", input: "Create video games"},
      %{language: "pt", input: "Quero me tornar um advogado"},
      %{language: "es", input: "Como ganar seguidores en redes sociales"}
    ]
  end

  @impl EvalTask
  def prompt_cases do
    [
      %{language: "en", input: "I want to learn about painting"},
      %{language: "en", input: "I'm curious about the universe"},
      %{language: "en", input: "DNA and genetics"},
      %{language: "en", input: "What is the periodic table?"},
      %{language: "pt", input: "Quero me comunicar melhor"},
      %{language: "pt", input: "kpop"},
      %{language: "en", input: "How to design a website?"},
      %{language: "en", input: "I want to build robots"},
      %{language: "en", input: "Engineering"},
      %{language: "pt", input: "Como funcionam os vulcões?"},
      %{language: "pt", input: "Quero cuidar da minha saúde"},
      %{language: "es", input: "Quiero entender la Segunda Guerra Mundial"},
      %{language: "en", input: "History"},
      %{language: "en", input: "I want to learn about law"},
      %{language: "pt", input: "direito constitucional"},
      %{language: "es", input: "derecho"},
      %{language: "en", input: "i suck at math"},
      %{language: "pt", input: "Quero entender como funciona a sociedade"},
      %{language: "en", input: "Tech stuff"},
      %{language: "en", input: "I want to help people"},
      %{language: "pt", input: "quero ficar rico"},
      %{language: "en", input: "Basics of web and mobile development"},
      %{language: "pt", input: "Educação Financeira"},
      %{language: "pt", input: "como funciona o sus"},
      %{language: "pt", input: "historia do brasil"},
      %{language: "en", input: "machne leanig"},
      %{language: "pt", input: "coding"},
      %{language: "es", input: "aprender inglés"},
      %{language: "pt", input: "quero falar coreano"}
    ]
  end
end
