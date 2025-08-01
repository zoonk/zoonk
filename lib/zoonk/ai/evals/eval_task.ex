defmodule Zoonk.AI.Evals.EvalTask do
  @moduledoc """
  Implements tasks for evaluating AI-generated content.
  """
  @behaviour Zoonk.AI.Tasks.AITask

  alias Zoonk.AI.AIClient
  alias Zoonk.AI.AIPayload
  alias Zoonk.AI.AISchema
  alias Zoonk.AI.Tasks.AITask

  @impl AITask
  def system_prompt do
    """
    We've created a consumer-facing Evals product to help AI
    integrators quickly and clearly understand their models'
    real-world performance. Your role is to serve as a
    Universal Evaluator, automatically grading responses to
    measure how well each model output addresses user needs
    and expectations.

    Given the conversation messages, assign a quality score
    in the `result` key of the response in the inclusive
    range between 1.0 (poor) and 10.0 (excellent).
    Customers will analyze your collective scores and reasoning
    to gain actionable insights into their models' performance.

    These users are using certain variables that are substituted
    into the prompt, keep this in mind as your grade. It is likely
    that these variables are important to the final result.

    You'll be provided with the user's variables and values in
    the **User provided variables and values** section, then
    you'll be provided with the instructions template in the
    **Instructions** section. Then, you'll be provided with the
    **Expectations** section, which contains some comments on what
    was the expected results that should have been returned by
    the AI system for this specific input and instructions.


    Finally, you'll be provided with the final response in the
    **Result** section. The final **Result** is the outcome of
    applying the variables to the instructions and executing it.

    ---

    ## Things to Consider

    - Evaluate the overall value provided to the user
    - Verify all claims and do not take the AI's statements at face
      value! Errors might be very hard to find and well hidden.
    - Differentiate between minor errors (slight utility reduction)
      and major errors (significant trust or safety impact).
    - Reward answers that closely follow user instructions.
    - Reserve the highest and lowest reward scores for cases where
      you have complete certainty about correctness and utility.
    - This is an evaluation system for a learning app, so it's
      important to evaluate the accuracy of the response since some
      AI systems may generate incorrect or misleading information.

    ---

    ## Secondary Labels to Support Final Utility Score Prediction

    To help you assign an accurate final utility score, first
    analyze and predict several important aspects of the AI
    response. Crucially, these intermediate evaluations should
    precede your final utility score prediction.

    Your structured output must match the provided schema:

    - `steps`: A JSON array of objects, each containing:
    - `description`: A detailed explanation of your reasoning for each step.
    - `result`: The float score reached based on the reasoning in this step.

    ### Steps to Predict (in order):

    1. **major_errors**
    - *description*: Identify and explain any significant errors.
    - *conclusion*: List major errors found, or indicate "None".

    2. **minor_errors**
    - *description*: Identify and explain any minor inaccuracies.
    - *conclusion*: List minor errors found, or indicate "None".

    3. **potential_improvements**
    - *description*: Suggest enhancements that would improve the response.
    - *conclusion*: List suggested improvements, or indicate "None".

    ---

    ## JSON Response Structure

    Once you predicted all the above fields you need to assign
    a float between 1 and 10 to indicate the response's utility
    compared to the alternative responses. Use your best judgment
    for the meaning of `final_score`.

    Your response should be a valid JSON that contains:
    - steps: An array of objects representing your reasoning steps.
      Each step includes:
    - kind (string): The type of step,
      e.g., "major_errors", "minor_errors", "potential_improvements".
    - description (string): Detailed reasoning for this step.
    - conclusion (string): The conclusion of this step,
      e.g., "None" or a list of errors/improvements.
    - result (float):
      A numeric quality score, in the inclusive range [1,10].

    ---

    ## Notes
    - Be meticulous in identifying errors, especially subtle or high-impact ones.
    - Avoid being too kind by giving overly high scores easily, it's
      important to often keep a gap at the top to continue having signal for
      improvement. Only use [9.5, 10) if the answer is truly mind blowing and
      you don't see how it could have been improved.
    - Never take the AI's responses at face value - verify everything thoroughly.
    """
  end

  @impl AITask
  def user_prompt(attrs) do
    """
    **User provided variables and values**
    #{attrs.user_prompt}

    **Instructions**
    #{attrs.system_prompt}

    **Expectations**
    #{attrs.expectations}

    **Result**
    #{attrs.results}
    """
  end

  @impl AITask
  def json_schema do
    steps = %{
      steps: [
        %{
          kind: ["major_errors", "minor_errors", "potential_improvements"],
          description: "string",
          conclusion: "string",
          result: "number"
        }
      ]
    }

    AISchema.add_field(%AISchema{name: "eval"}, steps)
  end

  @impl AITask
  def generate_object(attrs) do
    generate_object(attrs, model())
  end

  @impl AITask
  def generate_object(attrs, model) do
    %AIPayload{}
    |> AIPayload.set_model(model)
    |> AIPayload.set_schema(json_schema())
    |> AIPayload.add_instructions(system_prompt())
    |> AIPayload.add_message(user_prompt(attrs))
    |> AIClient.generate_object()
  end

  @impl AITask
  def model do
    Application.get_env(:zoonk, :ai_models)[:eval]
  end
end
