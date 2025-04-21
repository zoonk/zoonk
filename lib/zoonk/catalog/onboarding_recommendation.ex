defmodule Zoonk.Catalog.OnboardingRecommendation do
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

    field :recommendations, {:array, :map}, default: []

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
    |> cast(attrs, [:query, :language, :recommendations])
    |> validate_required([:query, :language])
  end
end
