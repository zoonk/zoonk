defmodule Zoonk.Agents.CourseSuggestions do
  @moduledoc """
  Schema representing a list of course suggestions from an LLM.

  | Field        | Type  | Description                                              |
  |--------------|-------|----------------------------------------------------------|
  | courses      | List  | List of maps with course title and description           |
  """
  use Ecto.Schema
  use Instructor

  import Ecto.Changeset

  @llm_doc """
  A schema that represents multiple course suggestions based on user input.

  ### Field Descriptions:

  - courses: A list of 3-5 course suggestions, each as a map with two fields:
      - title: The course name (1-4 words, super concise), in the same language as the input)
      - description: A 1-sentence description explaining what the course is about and why it could be useful to learn.
  """
  @primary_key false
  embedded_schema do
    embeds_many :courses, Zoonk.Agents.CourseSuggestion
  end

  @impl true
  def validate_changeset(changeset) do
    cast_embed(changeset, :courses, required: true)
  end
end

defmodule Zoonk.Agents.CourseSuggestion do
  @moduledoc false
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :title, :string
    field :description, :string
  end

  @doc false
  def changeset(course_suggestion, attrs) do
    course_suggestion
    |> cast(attrs, [:title, :description])
    |> validate_required([:title, :description])
  end
end
