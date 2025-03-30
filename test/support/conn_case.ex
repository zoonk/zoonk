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
      import PhoenixTest
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
    user = Zoonk.AccountFixtures.user_fixture()
    app_org = Zoonk.OrgFixtures.app_org_fixture()
    org_member = Zoonk.OrgFixtures.org_member_fixture(%{user: user, org: app_org})

    scope =
      %Zoonk.Scope{}
      |> Zoonk.Scope.set(app_org)
      |> Zoonk.Scope.set(user)
      |> Zoonk.Scope.set(org_member)

    opts =
      context
      |> Map.take([:token_inserted_at])
      |> Enum.to_list()

    %{conn: login_user(conn, user, opts), user: user, org: app_org, org_member: org_member, scope: scope}
  end

  @doc """
  Logs the given `user` into the `conn`.

  It returns an updated `conn`.
  """
  def login_user(conn, user, opts \\ []) do
    token = Zoonk.Accounts.generate_user_session_token(user)

    maybe_set_token_inserted_at(token, opts[:token_inserted_at])

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
  end

  defp maybe_set_token_inserted_at(_token, nil), do: nil

  defp maybe_set_token_inserted_at(token, inserted_at) do
    Zoonk.AccountFixtures.override_token_inserted_at(token, inserted_at)
  end

  @doc """
  Set up helper that assigns an org to the scope.

      setup :setup_org

  It stores an updated connection using an org's custom
  domain as the host and adding them to the scope.
  """
  def setup_org(%{conn: conn}, opts \\ []) do
    org = get_org(Keyword.get(opts, :org_kind, :app))
    scope = Zoonk.Scope.set(%Zoonk.Scope{}, org)
    conn = Map.put(conn, :host, org.custom_domain)
    %{conn: conn, org: org, scope: scope}
  end

  def setup_team(context), do: setup_org(context, org_kind: :team)
  def setup_school(context), do: setup_org(context, org_kind: :school)
  def setup_app(context), do: setup_org(context, org_kind: :app)
  def setup_creator(context), do: setup_org(context, org_kind: :creator)

  defp get_org(:app), do: Zoonk.OrgFixtures.app_org_fixture()

  defp get_org(kind),
    do: Zoonk.OrgFixtures.org_fixture(%{kind: kind, custom_domain: "zoonk.test-#{System.unique_integer()}"})
end
