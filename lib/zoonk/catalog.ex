defmodule Zoonk.Catalog do
  @moduledoc """
  The Catalog context.

  This context handles operations related to courses and their translations.
  It provides a way to manage educational content within the platform.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Catalog.Content
  alias Zoonk.Catalog.ContentReaction
  alias Zoonk.Catalog.CourseSuggestion
  alias Zoonk.Repo
  alias Zoonk.Scope

  @doc """
  Creates a course suggestion.

  ## Examples

      iex> Zoonk.Catalog.create_course_suggestion(%{})
      {:ok, %Zoonk.Catalog.CourseSuggestion{}}
  """
  def create_course_suggestion(%Scope{org: org}, attrs \\ %{}) do
    Repo.transact(fn ->
      content = Repo.insert!(%Content{kind: :course_suggestion, org_id: org.id})

      %CourseSuggestion{content_id: content.id}
      |> CourseSuggestion.changeset(attrs)
      |> Repo.insert()
    end)
  end

  @doc """
  Creates a content reaction.

  ## Examples

      iex> create_content_reaction(scope, %{content_id: 123, reaction: :thumbs_up})
      {:ok, %ContentReaction{}}
  """
  def create_content_reaction(%Scope{org: org, user: user}, attrs) do
    %ContentReaction{org_id: org.id, user_id: user.id}
    |> ContentReaction.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a content reaction.

  Returns `{:ok, reaction}` if the update is successful, or `{:error, :unauthorized}`
  if the user is trying to update another user's reaction.

  ## Examples

      iex> update_content_reaction(scope, reaction, %{reaction: :thumbs_down})
      {:ok, %ContentReaction{}}

      iex> update_content_reaction(scope_with_different_user, reaction, %{reaction: :thumbs_down})
      {:error, :unauthorized}
  """
  def update_content_reaction(%Scope{user: user}, %ContentReaction{user_id: user_id}, _attrs) when user.id != user_id do
    {:error, :unauthorized}
  end

  def update_content_reaction(%Scope{}, %ContentReaction{} = reaction, attrs) do
    reaction
    |> ContentReaction.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Gets a content reaction for a specific content.

  ## Examples

      iex> get_content_reaction(scope, 123)
      %ContentReaction{}

      iex> get_content_reaction(scope, 456)
      nil
  """
  def get_content_reaction(%Scope{org: org, user: user}, content_id) do
    Repo.get_by(ContentReaction, org_id: org.id, user_id: user.id, content_id: content_id)
  end

  @doc """
  Lists content reactions with optional filtering.

  ## Options

    * `:limit` - Limits the number of returned reactions (default: 100)
    * `:offset` - Number of reactions to skip (default: 0)
    * `:reaction` - Filter by reaction type (`:thumbs_up` or `:thumbs_down`)

  ## Examples

      iex> list_content_reactions(scope, limit: 10)
      [%ContentReaction{}, ...]
  """
  def list_content_reactions(%Scope{org: org}, opts \\ []) do
    limit = Keyword.get(opts, :limit, 100)
    offset = Keyword.get(opts, :offset, 0)
    reaction = Keyword.get(opts, :reaction)

    ContentReaction
    |> where([cr], cr.org_id == ^org.id)
    |> then(fn query ->
      if reaction, do: where(query, [cr], cr.reaction == ^reaction), else: query
    end)
    |> order_by([cr], desc: cr.inserted_at)
    |> limit(^limit)
    |> offset(^offset)
    |> Repo.all()
  end
end
