defmodule Zoonk.Catalog do
  @moduledoc """
  The Catalog context.

  This context handles operations related to courses and their translations.
  It provides a way to manage educational content within the platform.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Catalog.Content
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
end
