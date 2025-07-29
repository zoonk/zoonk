defmodule Zoonk.AI.Evals.RecommendCoursesEval do
  @moduledoc false
  alias Zoonk.AI.Evals.FileUtils
  alias Zoonk.AI.Tasks.RecommendCourses

  require Logger

  def generate_outputs(:model, model) do
    generate_outputs(model_test_cases(), model, :model)
  end

  def generate_outputs(:prompt, model) do
    generate_outputs(prompt_test_cases(), model, :prompt)
  end

  defp generate_outputs(test_cases, model, output_type) do
    Logger.info("Generating #{output_type} outputs for model #{model}")

    test_cases
    |> Enum.with_index()
    |> Task.async_stream(&generate_output(&1, output_type, model), max_concurrency: 5, timeout: :infinity)
    |> Stream.run()
  end

  defp generate_output({test_case, index}, output_type, model) do
    filename = test_filename(index)
    file_exists? = FileUtils.file_exists?(output_type, model, :recommend_courses, "outputs", filename)

    if file_exists? do
      Logger.info("Skipping existing output for #{output_type} and input #{inspect(test_case)}")
      {:ok, %{output: "Output already exists", input: test_case}}
    else
      generate_test_case(model, test_case, index, output_type)
    end
  end

  defp generate_test_case(model, test_case, index, output_type) do
    Logger.info("Processing input: #{inspect(test_case)} for model: #{model}")

    case RecommendCourses.generate_object(test_case.input, test_case.language, model) do
      {:ok, response} ->
        data = %{output: response, input: test_case}
        filename = test_filename(index)

        FileUtils.store_output(output_type, model, :recommend_courses, "outputs", filename, data)
        {:ok, data}

      {:error, error} ->
        Logger.error("Error generating output for model #{model}: #{error}")
        {:error, error}
    end
  end

  defp test_filename(index) do
    "test_#{index + 1}.json"
  end

  defp model_test_cases do
    [
      %{language: "en", input: "I want to learn programming"},
      %{language: "en", input: "How to become a scientist?"},
      %{language: "en", input: "Create video games"},
      %{language: "pt", input: "Quero me tornar um advogado"},
      %{language: "es", input: "Como ganar seguidores en redes sociales"}
    ]
  end

  defp prompt_test_cases do
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
