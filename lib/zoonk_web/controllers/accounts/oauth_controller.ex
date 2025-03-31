defmodule ZoonkWeb.Accounts.OAuthController do
  @moduledoc """
  Handles OAuth authentication.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias ZoonkWeb.UserAuth

  @oauth_state_cookie "_zk_oauth_state"

  def request(conn, params) do
    provider = get_provider(params)
    config = config!(conn, provider)

    config
    |> config[:strategy].authorize_url()
    |> handle_request(conn, provider)
  end

  def callback(conn, params) do
    conn
    |> strategy_callback(params)
    |> handle_callback(conn, get_provider(params))
  end

  defp handle_request({:ok, %{url: url, session_params: session_params}}, conn, provider) do
    # Session params (used for OAuth 2.0 and OIDC strategies) will be
    # retrieved when user returns for the callback phase
    conn = put_session(conn, :session_params, session_params)

    # Redirect end-user to the provider to authorize access to their account
    # Something went wrong generating the request authorization url
    conn
    |> maybe_add_oauth_cookie(provider, session_params)
    |> put_resp_header("location", url)
    |> send_resp(302, "")
  end

  defp handle_request({:error, _error}, conn, _provider), do: redirect_on_failure(conn)

  defp handle_callback({:ok, %{user: user_from_provider, token: _token}}, conn, provider) do
    language = get_session(conn, :language)
    auth = Map.put(user_from_provider, "provider", provider)

    case Accounts.login_with_provider(auth, conn.assigns.scope, language) do
      {:ok, %User{} = user} ->
        UserAuth.login_user(conn, user)

      {:error, _changeset} ->
        redirect_on_failure(conn)
    end
  end

  defp handle_callback({:error, _error}, conn, _provider), do: redirect_on_failure(conn)

  defp config!(%Plug.Conn{} = conn, provider) do
    config = get_provider_config!(provider)
    host = get_redirect_host(conn)
    redirect_uri = "#{host}/auth/#{provider}/callback"

    Keyword.put(config, :redirect_uri, redirect_uri)
  end

  defp get_provider(params), do: String.to_existing_atom(params["provider"])

  defp redirect_on_failure(%Plug.Conn{} = conn) do
    conn
    |> put_flash(:error, dgettext("users", "Failed to authenticate"))
    |> redirect(to: ~p"/login")
  end

  # when developing locally, we need to include the port in the redirect_uri
  defp get_redirect_host(%Plug.Conn{port: 4000} = conn), do: "http://#{conn.host}:4000"
  defp get_redirect_host(%Plug.Conn{port: 4001} = conn), do: "https://#{conn.host}:4001"
  defp get_redirect_host(%Plug.Conn{host: host}), do: "https://#{host}"

  defp get_provider_config!(provider),
    do: get_provider_config!(provider, Application.get_env(:zoonk, :strategies)[provider])

  defp get_provider_config!(provider, nil), do: raise("No provider configuration for #{provider}")
  defp get_provider_config!(_provider, config), do: config

  defp strategy_callback(%Plug.Conn{} = conn, params) do
    provider = get_provider(params)
    config = config!(conn, provider)

    # End-user will return to the callback URL with params attached to the
    # request. These must be passed on to the strategy. In this example we only
    # expect GET query params, but the provider could also return the user with
    # a POST request where the params is in the POST body.
    %{params: query_params} = fetch_query_params(conn)

    # The session params (used for OAuth 2.0 and OIDC strategies) stored in the
    # request phase will be used in the callback phase
    session_params =
      conn
      |> get_session(:session_params, %{})
      |> maybe_add_cookie_to_params(conn)

    config
    # Session params should be added to the config so the strategy can use them
    |> Keyword.put(:session_params, session_params)
    |> config[:strategy].callback(query_params)
  end

  # Apple requires a same_site: "None" cookie
  defp maybe_add_oauth_cookie(%Plug.Conn{} = conn, :apple, session_params) do
    put_resp_cookie(conn, @oauth_state_cookie, session_params.state,
      http_only: true,
      secure: true,
      same_site: "None"
    )
  end

  defp maybe_add_oauth_cookie(conn, _provider, _session_params), do: conn

  defp maybe_add_cookie_to_params(%{state: _state} = params, _conn), do: params

  defp maybe_add_cookie_to_params(params, %Plug.Conn{} = conn),
    do: Map.put(params, :state, conn.cookies[@oauth_state_cookie])
end
