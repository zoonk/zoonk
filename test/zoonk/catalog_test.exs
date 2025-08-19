defmodule Zoonk.CatalogTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Catalog
  alias Zoonk.Catalog.Content
  alias Zoonk.Catalog.ContentReaction
  alias Zoonk.Catalog.CourseSuggestion

  describe "create_course_suggestion/1" do
    test "creates a course suggestion with valid attrs" do
      scope = scope_fixture()

      attrs = %{
        "query" => "data science",
        "language" => :en,
        "suggestions" => [
          %{"title" => "Data Science", "description" => "Learn data analysis", "english_title" => "Data Science"}
        ]
      }

      assert {:ok, %CourseSuggestion{} = course_suggestion} = Catalog.create_course_suggestion(scope, attrs)
      assert is_integer(course_suggestion.content_id)
      assert course_suggestion.query == "data science"
      assert course_suggestion.language == :en
      [suggestion] = course_suggestion.suggestions
      assert suggestion.title == "Data Science"
      assert suggestion.description == "Learn data analysis"
    end

    test "returns error changeset when required fields missing" do
      scope = scope_fixture()
      assert {:error, changeset} = Catalog.create_course_suggestion(scope, %{"suggestions" => []})
      assert "can't be blank" in errors_on(changeset).query
    end
  end

  describe "create_content_reaction/2" do
    setup do
      scope = scope_fixture()
      content = Repo.insert!(%Content{kind: :course, org_id: scope.org.id})

      {:ok, scope: scope, content_id: content.id}
    end

    test "creates a reaction with valid attributes", %{scope: scope, content_id: content_id} do
      attrs = %{content_id: content_id, reaction: :thumbs_up}

      assert {:ok, %ContentReaction{} = reaction} = Catalog.create_content_reaction(scope, attrs)
      assert reaction.content_id == content_id
      assert reaction.reaction == :thumbs_up
      assert reaction.org_id == scope.org.id
      assert reaction.user_id == scope.user.id
    end

    test "returns error with invalid attributes", %{scope: scope} do
      attrs = %{reaction: :thumbs_up}
      assert {:error, changeset} = Catalog.create_content_reaction(scope, attrs)
      assert "can't be blank" in errors_on(changeset).content_id
    end
  end

  describe "update_content_reaction/3" do
    setup do
      scope = scope_fixture()
      content = Repo.insert!(%Content{kind: :course, org_id: scope.org.id})

      {:ok, scope: scope, content_id: content.id}
    end

    test "updates a reaction", %{scope: scope, content_id: content_id} do
      {:ok, reaction} = Catalog.create_content_reaction(scope, %{content_id: content_id, reaction: :thumbs_up})

      assert {:ok, updated_reaction} = Catalog.update_content_reaction(scope, reaction, %{reaction: :thumbs_down})
      assert updated_reaction.reaction == :thumbs_down
    end

    test "returns error when updating another user's reaction", %{scope: scope, content_id: content_id} do
      {:ok, reaction} = Catalog.create_content_reaction(scope, %{content_id: content_id, reaction: :thumbs_up})

      other_scope = scope_fixture()
      assert {:error, :unauthorized} = Catalog.update_content_reaction(other_scope, reaction, %{reaction: :thumbs_down})

      unchanged_reaction = Repo.get(ContentReaction, reaction.id)
      assert unchanged_reaction.reaction == :thumbs_up
    end
  end

  describe "get_content_reaction/2" do
    setup do
      scope = scope_fixture()
      content = Repo.insert!(%Content{kind: :course, org_id: scope.org.id})

      {:ok, scope: scope, content_id: content.id}
    end

    test "returns reaction when it exists", %{scope: scope, content_id: content_id} do
      another_scope = scope_fixture()
      Catalog.create_content_reaction(another_scope, %{content_id: content_id, reaction: :thumbs_down})

      {:ok, created_reaction} = Catalog.create_content_reaction(scope, %{content_id: content_id, reaction: :thumbs_up})

      reaction = Catalog.get_content_reaction(scope, content_id)
      assert reaction.user_id == scope.user.id
      assert reaction.id == created_reaction.id
      assert reaction.reaction == :thumbs_up
    end

    test "returns nil when reaction doesn't exist", %{scope: scope} do
      assert Catalog.get_content_reaction(scope, -1) == nil
    end
  end

  describe "list_content_reactions/2" do
    setup do
      scope = scope_fixture()
      content = Repo.insert!(%Content{kind: :course, org_id: scope.org.id})

      {:ok, scope: scope, content_id: content.id}
    end

    test "returns all reactions for an org", %{scope: scope, content_id: content_id} do
      another_content = Repo.insert!(%Content{kind: :course, org_id: scope.org.id})

      {:ok, _reaction} = Catalog.create_content_reaction(scope, %{content_id: content_id, reaction: :thumbs_up})
      {:ok, _reaction} = Catalog.create_content_reaction(scope, %{content_id: another_content.id, reaction: :thumbs_down})

      another_scope = scope_fixture(%{kind: :team})
      other_org_content = Repo.insert!(%Content{kind: :course, org_id: another_scope.org.id})

      {:ok, _reaction} =
        Catalog.create_content_reaction(another_scope, %{content_id: other_org_content.id, reaction: :thumbs_up})

      reactions = Catalog.list_content_reactions(scope)
      assert length(reactions) == 2
    end

    test "paginates results", %{scope: scope, content_id: content_id} do
      contents =
        for _index <- 1..5 do
          Repo.insert!(%Content{kind: :course, org_id: scope.org.id})
        end

      Enum.each([content_id | Enum.map(contents, & &1.id)], fn id ->
        Catalog.create_content_reaction(scope, %{content_id: id, reaction: :thumbs_up})
      end)

      limited_reactions = Catalog.list_content_reactions(scope, limit: 3)
      assert length(limited_reactions) == 3

      offset_reactions = Catalog.list_content_reactions(scope, offset: 3)
      assert length(offset_reactions) == 3
    end

    test "filters by reaction type", %{scope: scope, content_id: content_id} do
      another_content = Repo.insert!(%Content{kind: :course, org_id: scope.org.id})

      {:ok, _reaction} = Catalog.create_content_reaction(scope, %{content_id: content_id, reaction: :thumbs_up})
      {:ok, _reaction} = Catalog.create_content_reaction(scope, %{content_id: another_content.id, reaction: :thumbs_down})

      thumbs_up_reactions = Catalog.list_content_reactions(scope, reaction: :thumbs_up)
      assert length(thumbs_up_reactions) == 1
      assert List.first(thumbs_up_reactions).reaction == :thumbs_up

      thumbs_down_reactions = Catalog.list_content_reactions(scope, reaction: :thumbs_down)
      assert length(thumbs_down_reactions) == 1
      assert List.first(thumbs_down_reactions).reaction == :thumbs_down
    end
  end
end
