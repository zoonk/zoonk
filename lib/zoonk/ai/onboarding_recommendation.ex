defmodule Zoonk.AI.OnboardingRecommendation do
  @moduledoc """
  Schema for storing onboarding recommendations.

  This schema stores user queries during the onboarding process along with
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

  schema "onboarding_recommendations" do
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
  Creates a changeset for an onboarding recommendation.

  ## Examples

      iex> OnboardingRecommendation.changeset(%OnboardingRecommendation{}, %{query: "Computer Science", language: :en})
      #Ecto.Changeset<...>
  """
  def changeset(onboarding_recommendation, attrs) do
    onboarding_recommendation
    |> cast(attrs, [:query, :language])
    |> validate_required([:query, :language])
    |> cast_embed(:recommendations, with: &recommendation_changeset/2)
  end

  defp recommendation_changeset(recommendation, attrs) do
    recommendation
    |> cast(attrs, [:title, :description, :english_title])
    |> validate_required([:title, :description, :english_title])
  end
end
