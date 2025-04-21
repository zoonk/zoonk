defmodule Zoonk.AI.OnboardingRecommenderTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.Agents.OnboardingRecommender
  alias Zoonk.AI.OnboardingRecommendation
  alias Zoonk.Repo

  describe "recommend/2" do
    test "returns a recommendation from the AI" do
      input = "I want to learn about data science"
      title = "Data Science"
      description = "A field that uses scientific methods to analyze data."

      Req.Test.stub(:openai_client, fn conn ->
        Req.Test.json(conn, %{
          "error" => nil,
          "output" => [
            %{
              "content" => [
                %{
                  "type" => "output_text",
                  "text" => ~s({"courses":[{"title":"#{title}","description":"#{description}"}]})
                }
              ]
            }
          ]
        })
      end)

      assert {:ok, recommendations} = OnboardingRecommender.recommend(input, :en)
      recommendation = hd(recommendations.courses)
      assert recommendation.title == title
      assert recommendation.description == description
    end

    test "fetches data from cache when existing" do
      recommendations = [
        %{
          title: "Computer Science",
          description: "A field that studies the theory and practice of computing."
        }
      ]

      recommendation = hd(recommendations)
      query = String.downcase(recommendation.title)

      Repo.insert!(%OnboardingRecommendation{
        query: query,
        language: :en,
        recommendations: recommendations
      })

      assert {:ok, cached_recommendations} = OnboardingRecommender.recommend(query, :en)

      cached_recommendation = hd(cached_recommendations.courses)
      assert cached_recommendation.title == recommendation.title
      assert cached_recommendation.description == recommendation.description
    end
  end
end
