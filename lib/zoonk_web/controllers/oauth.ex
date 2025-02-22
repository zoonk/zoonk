defmodule ZoonkWeb.Controllers.OAuth do
  @moduledoc """
  Handles OAuth authentication.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Auth.Providers
  alias Zoonk.Schemas.User
  alias ZoonkWeb.Helpers.UserAuth

  def request(conn, params) do
    provider = get_provider(params)
    config = config!(conn, provider)

    config
    |> config[:strategy].authorize_url()
    |> handle_request(conn)
  end

  def callback(conn, params) do
    conn
    |> strategy_callback(params)
    |> handle_callback(conn, get_provider(params))
  end

  defp handle_request({:ok, %{url: url, session_params: session_params}}, conn) do
    # Session params (used for OAuth 2.0 and OIDC strategies) will be
    # retrieved when user returns for the callback phase
    conn = put_session(conn, :session_params, session_params)

    # Redirect end-user to the provider to authorize access to their account
    # Something went wrong generating the request authorization url
    conn
    |> put_resp_header("location", url)
    |> send_resp(302, "")
  end

  defp handle_request({:error, _error}, conn), do: redirect_on_failure(conn)

  defp handle_callback({:ok, %{user: user_from_provider, token: _token}}, conn, provider) do
    language = get_session(conn, :language)
    auth = Map.put(user_from_provider, "provider", provider)

    case Providers.signin_with_provider(auth, language) do
      {:ok, %User{} = user} ->
        UserAuth.signin_user(conn, user)

      {:error, _changeset} ->
        redirect_on_failure(conn)
    end
  end

  defp handle_callback({:error, _error}, conn, _provider), do: redirect_on_failure(conn)

  defp config!(%Plug.Conn{} = conn, provider) do
    config = get_provider_config!(provider)
    http_scheme = get_http_scheme(conn)
    host = get_redirect_host(conn)
    redirect_uri = "#{http_scheme}://#{host}/auth/#{provider}/callback"

    Keyword.put(config, :redirect_uri, redirect_uri)
  end

  defp get_provider(params), do: String.to_existing_atom(params["provider"])

  defp redirect_on_failure(%Plug.Conn{} = conn) do
    conn
    |> put_flash(:error, dgettext("users", "Failed to authenticate"))
    |> redirect(to: ~p"/users/signin")
  end

  defp get_redirect_host(%Plug.Conn{} = conn) do
    conn
    |> get_req_header("host")
    |> List.first()
  end

  defp get_http_scheme(%Plug.Conn{scheme: :http}), do: "http"
  defp get_http_scheme(%Plug.Conn{scheme: :https}), do: "https"

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
    session_params = get_session(conn, :session_params)

    config
    # Session params should be added to the config so the strategy can use them
    |> Keyword.put(:session_params, session_params)
    |> config[:strategy].callback(query_params)
  end
end
