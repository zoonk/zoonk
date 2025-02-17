defmodule ZoonkCredo.PipeEctoQueries do
  @moduledoc false
  use Credo.Check,
    base_priority: :high,
    category: :readability,
    explanations: [
      check: """
      This rule enforces a style preference for writing
      Ecto queries using pipes instead of `Ecto.Query.from/2`,
      aiming for better readability and maintainability.

      Using pipes improves query composition, makes the
      data flow clearer, and simplifies refactoring.

      ## Example

      Instead of:

          from(u in User, where: u.age > 18)

      Prefer:

          User
          |> where([u], u.age > 18)

      This check scans the source file for `Ecto.Query.from/2`
      and suggests using a piped query instead.
      """,
      params: []
    ]

  @impl Credo.Check
  def run(source_file, _params) do
    source_file
    |> Credo.Code.prewalk(&find_from_usage(&1, &2, source_file), [])
    |> Enum.reverse()
  end

  defp find_from_usage({:from, meta, _source} = ast, issues, source_file) do
    issue =
      format_issue(
        Credo.IssueMeta.for(source_file, []),
        message: "Avoid using `Ecto.Query.from/2`. Prefer pipes instead.",
        trigger: "from/2",
        line_no: meta[:line] || 0
      )

    {ast, [issue | issues]}
  end

  defp find_from_usage(ast, issues, _source), do: {ast, issues}
end
