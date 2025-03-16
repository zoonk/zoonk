defmodule ZoonkWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.

  Such tests rely on `Phoenix.ConnTest` and also
  import other functionality to make it easier
  to build common data structures and query the data layer.

  Finally, if the test case interacts with the database,
  we enable the SQL sandbox, so changes done to the database
  are reverted at the end of every test. If you are using
  PostgreSQL, you can even run database tests asynchronously
  by setting `use ZoonkWeb.ConnCase, async: true`, although
  this option is not recommended for other databases.
  """
  use ExUnit.CaseTemplate

  using do
    quote do
      use ZoonkWeb, :verified_routes

      # Import conveniences for testing with connections
      import Phoenix.ConnTest
      import Plug.Conn
      import ZoonkWeb.ConnCase

      # The default endpoint for testing
      @endpoint ZoonkWeb.Endpoint
    end
  end

  setup tags do
    Zoonk.DataCase.setup_sandbox(tags)
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end

  @doc """
  Setup helper that signs up and logs in users.

      setup :signup_and_login_user

  It stores an updated connection and a signed up user in the
  test context.
  """
  def signup_and_login_user(%{conn: conn} = context) do
    %{user: user, user_identity: user_identity} = Zoonk.AccountFixtures.user_fixture()
    scope = Zoonk.Accounts.Scope.for_user(user_identity)

    opts =
      context
      |> Map.take([:token_inserted_at])
      |> Enum.to_list()

    %{conn: login_user(conn, user_identity, opts), user: user, scope: scope}
  end

  @doc """
  Logs the given `user_identity` into the `conn`.

  It returns an updated `conn`.
  """
  def login_user(conn, user_identity, opts \\ []) do
    token = Zoonk.Accounts.generate_user_session_token(user_identity)
    maybe_set_token_inserted_at(token, opts[:token_inserted_at])

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
  end

  defp maybe_set_token_inserted_at(_token, nil), do: nil

  defp maybe_set_token_inserted_at(token, inserted_at) do
    Zoonk.AccountFixtures.override_token_inserted_at(token, inserted_at)
  end
end
