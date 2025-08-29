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
  def signup_and_login_user(context) do
    app_org = Zoonk.OrgFixtures.system_org_fixture()
    context = Map.put(context, :org, app_org)
    signup_and_login_user_for_org(context)
  end

  @doc """
  Sign up and login user for a public external org.

      setup :signup_and_login_user_for_public_external_org

  """
  def signup_and_login_user_for_public_external_org(context) do
    org = Zoonk.OrgFixtures.org_fixture(%{kind: :external, is_public: true})
    context = Map.put(context, :org, org)
    signup_and_login_user_for_org(context)
  end

  @doc """
  Sign up and login user for a private external org.

      setup :signup_and_login_user_for_private_external_org

  """
  def signup_and_login_user_for_private_external_org(context) do
    org = Zoonk.OrgFixtures.org_fixture(%{kind: :external, is_public: false})
    context = Map.put(context, :org, org)
    signup_and_login_user_for_org(context)
  end

  @doc """
  Setup basic app.

      setup :setup_app

  It sets the system organization without a user.
  """
  def setup_app(%{conn: conn}) do
    app_org = Zoonk.OrgFixtures.system_org_fixture()
    conn = Map.put(conn, :host, app_org.custom_domain)
    %{conn: conn, org: app_org}
  end

  @doc """
  Setup app for a public external org.

      setup :setup_public_external_app

  It sets the external organization without a user.
  """
  def setup_public_external_app(%{conn: conn}) do
    setup_external_org(%{conn: conn, public?: true})
  end

  @doc """
  Setup app for a private external org.

      setup :setup_private_external_app

  It sets the external organization without a user.
  """
  def setup_private_external_app(%{conn: conn}) do
    setup_external_org(%{conn: conn, public?: false})
  end

  @doc """
  Logs the given `user` into the `conn`.

  It returns an updated `conn`.
  """
  def login_user(conn, user, opts \\ []) do
    token = Zoonk.Accounts.generate_user_session_token(user)

    maybe_set_token_authenticated_at(token, opts[:token_authenticated_at])

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
  end

  defp maybe_set_token_authenticated_at(_token, nil), do: nil

  defp maybe_set_token_authenticated_at(token, authenticated_at) do
    Zoonk.AccountFixtures.override_token_authenticated_at(token, authenticated_at)
  end

  defp setup_external_org(%{conn: conn, public?: public?}) do
    org = Zoonk.OrgFixtures.org_fixture(%{kind: :external, is_public: public?})
    conn = Map.put(conn, :host, org.custom_domain)
    %{conn: conn, org: org}
  end

  defp signup_and_login_user_for_org(%{conn: conn, org: org} = context) do
    user = Zoonk.AccountFixtures.user_fixture()

    opts =
      context
      |> Map.take([:token_authenticated_at])
      |> Enum.to_list()

    conn = Map.put(conn, :host, org.custom_domain)

    scope = %Zoonk.Scope{user: user, org: org}
    Zoonk.OrgFixtures.org_member_fixture(%{user: user, org: org})

    %{conn: login_user(conn, user, opts), user: user, scope: scope}
  end
end
