defmodule Zoonk.AI.Evals.EvalRunner do
  @moduledoc """
  A module for running evaluations on AI models.
  """
  alias Zoonk.AI.Evals.FileUtils

  require Logger

  @stream_opts [max_concurrency: 5, timeout: :infinity]

  @doc """
  Generate objects for a given task module and output type using the specified model.
  """
  @spec generate_object(module(), FileUtils.output_type(), String.t()) :: :ok
  def generate_object(task_module, output_type, model) do
    prompt = prompt_name_from_module(task_module)

    Logger.info("Generating #{prompt} #{output_type} using model #{model}")

    task_module
    |> test_cases(output_type)
    |> Enum.with_index(1)
    |> Task.async_stream(
      fn {test_case, index} -> generate_object(task_module, prompt, output_type, model, test_case, index) end,
      @stream_opts
    )
    |> Stream.run()
  end

  defp generate_object(task_module, prompt, output_type, model, test_case, index) do
    filename = "test_#{index}.json"

    if FileUtils.file_exists?(output_type, model, prompt, "outputs", filename) do
      Logger.info("Skipping existing output for #{prompt} #{output_type} and input #{inspect(test_case)}")
      {:ok, %{output: "Output already exists", input: test_case}}
    else
      model
      |> task_module.generate_object(test_case)
      |> store_generate_output(prompt, output_type, model, test_case, filename)
    end
  end

  defp store_generate_output({:ok, response}, prompt, output_type, model, test_case, filename) do
    data = %{output: response, input: test_case}
    FileUtils.store_output(output_type, model, prompt, "outputs", filename, data)
    {:ok, data}
  end

  defp store_generate_output({:error, error}, _prompt, _output_type, _model, _test_case, _filename) do
    Logger.error("Error generating output: #{inspect(error)}")
    {:error, error}
  end

  defp test_cases(task_module, :model), do: task_module.model_cases()
  defp test_cases(task_module, :prompt), do: task_module.prompt_cases()

  defp prompt_name_from_module(mod) do
    mod
    |> Module.split()
    |> List.last()
    |> String.replace_suffix("Eval", "")
    |> Macro.underscore()
    |> String.to_existing_atom()
  end
end
