defmodule Zoonk.Repo.Migrations.CreateRegionsTable do
  use Ecto.Migration

  def change do
    create table(:regions) do
      add :name, :string
      add :translations, :string
      add :wikiDataId, :string
      add :created_at, :naive_datetime
      add :updated_at, :naive_datetime
    end
  end
end
