defmodule Zoonk.Repo.Migrations.CreateUserProvidersTable do
  use Ecto.Migration

  def change do
    create table(:user_providers) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :provider, :string, null: false
      add :provider_uid, :string, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:user_providers, [:user_id, :provider])
    create unique_index(:user_providers, [:provider, :provider_uid])
  end
end
