defmodule Zoonk.Agents.CourseNameSuggestion do
  @moduledoc """
  Schema representing a list of course name suggestions from an LLM.

  | Field          | Type    | Description                                         |
  |----------------|---------|-----------------------------------------------------|
  | suggestions    | `List`  | List of suggested course names                      |
  | language       | `String`  | The detected language code (ISO 639-1) of the input |
  """
  use Ecto.Schema
  use Instructor

  import Ecto.Changeset

  @llm_doc """
  A schema that represents multiple course name suggestions based on user input.

  ### Field Descriptions:
  - suggestions: A list of 2-10 course name suggestions, each suitable for an online learning platform.
    Each name should be concise but descriptive, usually 2-6 words, and in the same language as the input.
  - language: The ISO 639-1 language code detected in the user input (e.g., "en", "es", "pt", "fr", "zh").
  """
  @primary_key false
  embedded_schema do
    field :suggestions, {:array, :string}, default: []
    field :language, :string
  end

  @impl true
  def validate_changeset(changeset) do
    changeset
    |> validate_required([:suggestions, :language])
    |> validate_length(:suggestions, min: 2, max: 10)
    |> validate_length(:language, is: 2)
  end
end
