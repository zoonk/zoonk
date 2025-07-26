defmodule Zoonk.AITest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI
  alias Zoonk.AI.CourseRecommendation
  alias Zoonk.Repo

  describe "recommend_courses/2" do
    test "returns a recommendation from the AI" do
      input = "I want to learn about data science"
      title = "Data Science"
      description = "A field that uses scientific methods to analyze data."
      english_title = "Data Science"

      openai_stub(%{courses: [%{title: title, description: description, english_title: english_title}]})

      assert {:ok, recommendations} = AI.recommend_courses(input, :en)
      recommendation = hd(recommendations.courses)
      assert recommendation.title == title
      assert recommendation.description == description
    end

    test "fetches data from cache when existing" do
      courses = [
        %{
          title: "Computer Science",
          description: "A field that studies the theory and practice of computing.",
          english_title: "Computer Science"
        }
      ]

      recommendation = hd(courses)
      query = String.downcase(recommendation.title)

      Repo.insert!(%CourseRecommendation{
        query: query,
        language: :en,
        courses: courses
      })

      assert {:ok, cached_recommendations} = AI.recommend_courses(query, :en)

      cached_recommendation = hd(cached_recommendations.courses)
      assert cached_recommendation.title == recommendation.title
      assert cached_recommendation.description == recommendation.description
    end

    test "adds recommendations to the database" do
      input = "great course"
      title = "Great Course"
      description = "A field that uses scientific methods to analyze data."

      openai_stub(%{courses: [%{title: title, description: description, english_title: "Great Course"}]})

      assert {:ok, _recommendations} = AI.recommend_courses(input, :en)

      cache = Repo.get_by(CourseRecommendation, query: input, language: :en)
      recommendation = hd(cache.courses)
      assert recommendation.title == title
      assert recommendation.description == description
    end
  end
end
