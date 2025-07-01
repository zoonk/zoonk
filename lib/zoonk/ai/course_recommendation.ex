defmodule Zoonk.AI.CourseRecommendation do
  @moduledoc """
  Schema for storing learning recommendations.

  This schema stores user queries when they want to learn a subject along with
  the AI-generated course recommendations. Storing these recommendations
  allows us to avoid repeated AI calls for common queries.

  ## Fields

  | Field Name       | Type        | Description                                      |
  |------------------|-------------|--------------------------------------------------|
  | `query`          | `String`    | The user's input about what they want to learn.  |
  | `language`       | `Ecto.Enum` | The language of the query and recommendations.   |
  | `courses`        | `List`      | Collection of recommended courses.               |
  | `inserted_at`    | `DateTime`  | Timestamp when the recommendation was created.   |
  | `updated_at`     | `DateTime`  | Timestamp when the recommendation was updated.   |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Localization

  schema "course_recommendations" do
    field :query, :string

    field :language, Ecto.Enum,
      values: Localization.list_languages(:atom),
      default: Localization.get_default_language(:atom)

    embeds_many :courses, Course do
      field :title, :string
      field :description, :string
      field :icon, :string
      field :english_title, :string
    end

    timestamps(type: :utc_datetime_usec)
  end

  @doc """
  Creates a changeset for a course recommendation.

  ## Examples

      iex> CourseRecommendation.changeset(%CourseRecommendation{}, %{query: "Computer Science", language: :en})
      #Ecto.Changeset<...>
  """
  def changeset(course_recommendation, attrs) do
    course_recommendation
    |> cast(attrs, [:query, :language])
    |> validate_required([:query, :language])
    |> cast_embed(:courses, with: &course_changeset/2)
  end

  defp course_changeset(course, attrs) do
    course
    |> cast(attrs, [:title, :description, :english_title, :icon])
    |> validate_required([:title, :description, :english_title])
  end
end
