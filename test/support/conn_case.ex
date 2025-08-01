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

    opts =
      context
      |> Map.take([:token_authenticated_at])
      |> Enum.to_list()

    conn = Map.put(conn, :host, app_org.custom_domain)

    scope = %Zoonk.Scope{user: user, org: app_org}

    %{conn: login_user(conn, user, opts), user: user, scope: scope}
  end

  @doc """
  Setup basic app.

      setup :setup_app

  It sets the app organization without a user.
  """
  def setup_app(%{conn: conn}) do
    app_org = Zoonk.OrgFixtures.app_org_fixture()
    conn = Map.put(conn, :host, app_org.custom_domain)
    %{conn: conn, org: app_org}
  end

  @doc """
  Setup basic app for the API.

      setup :setup_api_app
  """
  def setup_api_app(%{conn: conn}) do
    app_org = Zoonk.OrgFixtures.app_org_fixture()

    conn = Plug.Conn.put_req_header(conn, "x-org-domain", app_org.custom_domain)

    %{conn: conn}
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

  @doc """
  Asserts a JSON error response that calls `ZoonkWeb.API.ErrorResponse.send_error/3`.
  """
  def assert_json_error(conn, status) do
    assert %{"error" => %{"code" => ^status, "message" => _message}} = Phoenix.ConnTest.json_response(conn, status)
  end
end
