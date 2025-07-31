defmodule Zoonk.AI.Evals.EvalRunner do
  @moduledoc """
  A module for running evaluations on AI models.
  """
  alias Zoonk.AI.Evals.EvalFiles
  alias Zoonk.AI.Evals.EvalModels

  require Logger

  @stream_opts [max_concurrency: 5, timeout: :infinity]
  @token_cost_factor 1_000_000
  @tasks_factor 100

  @doc """
  Generate objects for a given task module and eval type for all models.
  """
  @spec generate_object(atom(), EvalFiles.eval_type()) :: :ok
  def generate_object(prompt, eval_type) do
    models = EvalModels.list_models()

    Logger.info("Generating objects for prompt #{prompt} with eval type #{eval_type}")

    Enum.each(models, fn model -> generate_object(prompt, eval_type, model.name) end)

    :ok
  end

  @doc """
  Generate objects for a given task module and eval type using the specified model.
  """
  @spec generate_object(atom(), EvalFiles.eval_type(), String.t()) :: :ok
  def generate_object(prompt, eval_type, model) do
    task_module = task_module(prompt)
    eval_module = eval_module(prompt)

    Logger.info("Generating #{prompt} #{eval_type} using model #{model}")
    Logger.info("Using task module: #{inspect(task_module)}")
    Logger.info("Using eval module: #{inspect(eval_module)}")

    eval_module
    |> apply(eval_type, [])
    |> Enum.with_index(1)
    |> Task.async_stream(
      fn {test_case, index} -> generate_object(task_module, prompt, eval_type, model, test_case, index) end,
      @stream_opts
    )
    |> Stream.run()
  end

  defp generate_object(task_module, prompt, eval_type, model, test_case, index) do
    filename = "test_#{index}.json"

    if EvalFiles.file_exists?(eval_type, model, prompt, "outputs", filename) do
      Logger.info("Skipping existing output for #{prompt} #{eval_type} and input #{inspect(test_case)}")
      {:ok, %{output: "Output already exists", input: test_case}}
    else
      system_prompt = task_module.system_prompt()
      user_prompt = task_module.user_prompt(test_case)

      input = Map.merge(%{user_prompt: user_prompt, system_prompt: system_prompt}, test_case)

      test_case
      |> task_module.generate_object(model)
      |> store_generate_output(prompt, eval_type, model, input, filename)
    end
  end

  defp store_generate_output({:ok, response}, prompt, eval_type, model, input, filename) do
    data = %{output: response, input: input, cost_per_100_tasks: calculate_cost(response, model)}
    EvalFiles.store_output(eval_type, model, prompt, "outputs", filename, data)
    {:ok, data}
  end

  defp store_generate_output({:error, error}, _prompt, _eval_type, _model, _input, _filename) do
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

  defp calculate_cost(response, model) do
    input_tokens = get_in(response, [:usage, :input])
    output_tokens = get_in(response, [:usage, :output])
    cost = cost_per_token(model)

    %{
      input: input_tokens * cost.input * @tasks_factor,
      output: output_tokens * cost.output * @tasks_factor
    }
  end

  defp cost_per_token(model) do
    model_data = EvalModels.get_model(model)

    %{
      input: model_data.input / @token_cost_factor,
      output: model_data.output / @token_cost_factor
    }
  end
end
