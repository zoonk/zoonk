# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     Zoonk.Repo.insert!(%Zoonk.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

# Import the world.sql file into the database
# This file adds the regions/locations data.
# Source: https://github.com/dr5hn/countries-states-cities-database
# This is a workaround for the fact that Ecto doesn't support
# importing SQL files directly
db_name = Application.fetch_env!(:zoonk, Zoonk.Repo)[:database]
username = Application.fetch_env!(:zoonk, Zoonk.Repo)[:username]
password = Application.fetch_env!(:zoonk, Zoonk.Repo)[:password]
host = Application.fetch_env!(:zoonk, Zoonk.Repo)[:hostname]
sql_file = Path.expand("deps/regions_db/psql/world.sql")

System.cmd("psql", ["-h", host, "-U", username, "-d", db_name, "-f", sql_file], env: [{"PGPASSWORD", password}])
