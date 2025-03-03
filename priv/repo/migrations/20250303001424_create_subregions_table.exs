defmodule Zoonk.Repo.Migrations.CreateSubregionsTable do
  use Ecto.Migration

  def change do
    create table(:subregions) do
      add :name, :string
      add :translations, :string
      add :wikiDataId, :string
      add :created_at, :naive_datetime
      add :updated_at, :naive_datetime

      add :region_id, references(:regions)
    end
  end
end
