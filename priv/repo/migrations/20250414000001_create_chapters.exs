defmodule Zoonk.Repo.Migrations.CreateChapters do
  use Ecto.Migration

  def change do
    create table(:chapters) do
      add :org_id, :bigint, null: false

      add :content_id,
          references(:contents, on_delete: :delete_all, with: [org_id: :org_id], match: :full),
          null: false

      add :slug, :citext, null: false
      add :thumb_url, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:chapters, [:id, :org_id])
    create unique_index(:chapters, [:org_id, :slug])
    create unique_index(:chapters, [:content_id])
  end
end
