defmodule Zoonk.AI.OnboardingRecommenderTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.Agents.OnboardingRecommender

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
  end
end
