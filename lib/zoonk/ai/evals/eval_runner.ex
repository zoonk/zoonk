defmodule Zoonk.AI.Evals.EvalRunner do
  @moduledoc """
  A module for running evaluations on AI models.
  """
  alias Zoonk.AI.Evals.EvalFiles

  require Logger

  @stream_opts [max_concurrency: 5, timeout: :infinity]

  @doc """
  Generate objects for a given task module and output type using the specified model.
  """
  @spec generate_object(atom(), EvalFiles.output_type(), String.t()) :: :ok
  def generate_object(prompt, output_type, model) do
    task_module = task_module(prompt)
    eval_module = eval_module(prompt)

    Logger.info("Generating #{prompt} #{output_type} using model #{model}")
    Logger.info("Using task module: #{inspect(task_module)}")
    Logger.info("Using eval module: #{inspect(eval_module)}")

    eval_module
    |> apply(output_type, [])
    |> Enum.with_index(1)
    |> Task.async_stream(
      fn {test_case, index} -> generate_object(task_module, prompt, output_type, model, test_case, index) end,
      @stream_opts
    )
    |> Stream.run()
  end

  defp generate_object(task_module, prompt, output_type, model, test_case, index) do
    filename = "test_#{index}.json"

    if EvalFiles.file_exists?(output_type, model, prompt, "outputs", filename) do
      Logger.info("Skipping existing output for #{prompt} #{output_type} and input #{inspect(test_case)}")
      {:ok, %{output: "Output already exists", input: test_case}}
    else
      system_prompt = task_module.system_prompt()
      user_prompt = task_module.user_prompt(test_case)

      input = Map.merge(%{user_prompt: user_prompt, system_prompt: system_prompt}, test_case)

      test_case
      |> task_module.generate_object(model)
      |> store_generate_output(prompt, output_type, model, input, filename)
    end
  end

  defp store_generate_output({:ok, response}, prompt, output_type, model, input, filename) do
    data = %{output: response, input: input}
    EvalFiles.store_output(output_type, model, prompt, "outputs", filename, data)
    {:ok, data}
  end

  defp store_generate_output({:error, error}, _prompt, _output_type, _model, _input, _filename) do
    Logger.error("Error generating output: #{inspect(error)}")
    {:error, error}
  end

  defp task_module(prompt) do
    Module.safe_concat(["Zoonk.AI.Tasks", module_name(prompt)])
  end

  defp eval_module(prompt) do
    Module.safe_concat(["Zoonk.AI.Evals", module_name(prompt) <> "Eval"])
  end

  defp module_name(prompt) do
    prompt
    |> Atom.to_string()
    |> Macro.camelize()
  end
end
