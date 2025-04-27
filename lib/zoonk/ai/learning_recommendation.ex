defmodule Zoonk.AI.LearningRecommendation do
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
  | `recommendations`| `List`      | Collection of recommended courses.               |
  | `inserted_at`    | `DateTime`  | Timestamp when the recommendation was created.   |
  | `updated_at`     | `DateTime`  | Timestamp when the recommendation was updated.   |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Config.LanguageConfig

  schema "learning_recommendations" do
    field :query, :string

    field :language, Ecto.Enum,
      values: LanguageConfig.list_languages(:atom),
      default: LanguageConfig.get_default_language(:atom)

    embeds_many :recommendations, Recommendation do
      field :title, :string
      field :description, :string
      field :icon, :string
      field :english_title, :string
    end

    timestamps(type: :utc_datetime_usec)
  end

  @doc """
  Creates a changeset for a learning recommendation.

  ## Examples

      iex> LearningRecommendation.changeset(%LearningRecommendation{}, %{query: "Computer Science", language: :en})
      #Ecto.Changeset<...>
  """
  def changeset(learning_recommendation, attrs) do
    learning_recommendation
    |> cast(attrs, [:query, :language])
    |> validate_required([:query, :language])
    |> cast_embed(:recommendations, with: &recommendation_changeset/2)
  end

  defp recommendation_changeset(recommendation, attrs) do
    recommendation
    |> cast(attrs, [:title, :description, :english_title, :icon])
    |> validate_required([:title, :description, :english_title])
  end
end
