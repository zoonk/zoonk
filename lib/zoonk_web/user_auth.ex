defmodule ZoonkWeb.UserAuth do
  @moduledoc """
  Session management for user authentication.

  This module manages user sign in and sign out by handling session tokens,
  renewing sessions to prevent fixation attacks, and coordinating disconnects
  for LiveView sessions.
  """
  use ZoonkWeb, :verified_routes

  import Phoenix.Controller
  import Plug.Conn

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias Zoonk.Billing
  alias Zoonk.Orgs
  alias Zoonk.Scope

  @session_validity_in_days Application.compile_env!(:zoonk, :user_token)[:max_age_days][:session]
  @renew_token_days Application.compile_env!(:zoonk, :user_token)[:renew_token_days]
  @max_age @session_validity_in_days * 24 * 60 * 60
  @remember_me_cookie "_zoonk_web_user_remember_me"
  @remember_me_options [sign: true, max_age: @max_age, same_site: "Lax"]

  @doc """
  Logs the user in.

  Redirects to the session's `:user_return_to` path
  or falls back to the `signed_in_path/1`.
  """
  def login_user(conn, %User{} = user) do
    user_return_to = get_session(conn, :user_return_to)

    conn
    |> create_or_extend_session(user)
    |> redirect(to: user_return_to || signed_in_path(conn))
  end

  @doc """
  Logs the user out.

  It clears all session data for safety. See renew_session.
  """
  def logout_user(conn) do
    user_token = get_session(conn, :user_token)
    user_token && Accounts.delete_user_session_token(user_token)

    if live_socket_id = get_session(conn, :live_socket_id) do
      ZoonkWeb.Endpoint.broadcast(live_socket_id, "disconnect", %{})
    end

    conn
    |> renew_session(nil)
    |> delete_resp_cookie(@remember_me_cookie)
    |> redirect(to: ~p"/catalog")
  end

  @doc """
  Authenticates the user by looking into the session
  and remember me token.

  Will reissue the session token if it is older than the configured age.
  """
  def fetch_scope(conn, _opts) do
    with {token, conn} <- ensure_user_token(conn),
         {user, token_inserted_at} <- Accounts.get_user_by_session_token(token) do
      conn
      |> assign(:scope, build_scope(user, conn.host))
      |> maybe_reissue_user_session_token(user, token_inserted_at)
    else
      nil ->
        assign(conn, :scope, build_scope(nil, conn.host))
    end
  end

  defp ensure_user_token(conn) do
    if token = get_session(conn, :user_token) do
      {token, conn}
    else
      conn = fetch_cookies(conn, signed: [@remember_me_cookie])

      if token = conn.cookies[@remember_me_cookie] do
        {token,
         conn
         |> put_token_in_session(token)
         |> put_session(:user_remember_me, true)}
      end
    end
  end

  @doc """
  Fetches the scope for API requests.
  """
  def fetch_api_scope(conn, _opts) do
    org_domain = get_req_header(conn, "x-org-domain")

    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {user, _token_inserted_at} <- Accounts.get_user_by_session_token(token) do
      assign(conn, :scope, build_scope(user, org_domain))
    else
      _header -> assign(conn, :scope, build_scope(nil, org_domain))
    end
  end

  # Reissue the session token if it is older than the configured reissue age.
  defp maybe_reissue_user_session_token(conn, user, token_inserted_at) do
    token_age = DateTime.diff(DateTime.utc_now(), token_inserted_at, :day)

    if token_age >= @renew_token_days do
      create_or_extend_session(conn, user)
    else
      conn
    end
  end

  # This function is the one responsible for creating session tokens
  # and storing them safely in the session and cookies. It may be called
  # either when logging in, during sudo mode, or to renew a session which
  # will soon expire.
  #
  # When the session is created, rather than extended, the renew_session
  # function will clear the session to avoid fixation attacks. See the
  # renew_session function to customize this behaviour.
  defp create_or_extend_session(conn, user) do
    token = Accounts.generate_user_session_token(user)

    conn
    |> renew_session(user)
    |> put_token_in_session(token)
    |> write_remember_me_cookie(token)
  end

  # Do not renew session if the user is already logged in
  # to prevent CSRF errors or data being last in tabs that are still open
  defp renew_session(conn, user) when conn.assigns.scope.user.id == user.id do
    conn
  end

  # This function renews the session ID and erases the whole
  # session to avoid fixation attacks. If there is any data
  # in the session you may want to preserve after log in/log out,
  # you must explicitly fetch the session data before clearing
  # and then immediately set it after clearing, for example:
  #
  #     defp renew_session(conn, _user) do
  #       delete_csrf_token()
  #       preferred_locale = get_session(conn, :preferred_locale)
  #
  #       conn
  #       |> configure_session(renew: true)
  #       |> clear_session()
  #       |> put_session(:preferred_locale, preferred_locale)
  #     end
  #
  defp renew_session(conn, _user) do
    delete_csrf_token()

    conn
    |> configure_session(renew: true)
    |> clear_session()
  end

  defp write_remember_me_cookie(conn, token) do
    conn
    |> put_session(:user_remember_me, true)
    |> put_resp_cookie(@remember_me_cookie, token, @remember_me_options)
  end

  @doc """
  Handles mounting and authenticating the scope in LiveViews.

  ## `on_mount` arguments

    * `:mount_scope` - Assigns scope
      to socket assigns based on user_token, or nil if
      there's no user_token or no matching user.

    * `:ensure_auth_for_private_orgs` - Ensures the user is authenticated
      for private organizations. If the organization is public, it continues;
      otherwise, it redirects to the login page.

    * `:ensure_sudo_mode` - Check if the user has been authenticated
      recently enough to access a certain page.

  ## Examples

  Use the `on_mount` lifecycle macro in LiveViews to mount or authenticate
  the scope:

      defmodule ZoonkWeb.PageLive do
        use ZoonkWeb, :live_view

        on_mount {ZoonkWeb.UserAuth, :mount_scope}
        ...
      end

  Or use the `live_session` of your router to invoke the on_mount callback:

      live_session :authenticated, on_mount: [{ZoonkWeb.UserAuth, :ensure_authenticated}] do
        live "/profile", ProfileLive, :index
      end
  """
  def on_mount(:mount_scope, _params, session, socket) do
    {:cont, mount_scope(socket, session)}
  end

  def on_mount(:ensure_auth_for_private_orgs, _params, _session, socket) do
    scope = socket.assigns.scope
    public_org? = scope.org.kind in [:app, :creator]

    if public_org? do
      {:cont, socket}
    else
      {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/login")}
    end
  end

  def on_mount(:ensure_sudo_mode, _params, session, socket) do
    socket = mount_scope(socket, session)

    if Accounts.sudo_mode?(socket.assigns.scope.user) do
      {:cont, socket}
    else
      socket =
        socket
        |> Phoenix.LiveView.put_flash(:error, dgettext("auth", "You need to reauthenticate to access this page."))
        |> Phoenix.LiveView.redirect(to: ~p"/login")

      {:halt, socket}
    end
  end

  defp mount_scope(socket, session) do
    %URI{host: host} = Phoenix.LiveView.get_connect_info(socket, :uri)

    Phoenix.Component.assign_new(socket, :scope, fn ->
      user = get_user_by_session_token(session["user_token"])
      build_scope(user, host)
    end)
  end

  defp get_user_by_session_token(nil), do: nil

  defp get_user_by_session_token(user_token) do
    case Accounts.get_user_by_session_token(user_token) do
      nil -> nil
      {user, _token_inserted_at} -> user
    end
  end

  @doc """
  Stores the return to path for unauthenticated users.

  This is used to redirect the user back to the page they were trying to access.
  We store it for all GET requests that are not login, signup, or confirmation pages.
  """
  def maybe_store_return_to(%{method: "GET"} = conn, _opts) do
    scope = conn.assigns.scope
    logged_in? = scope && scope.user
    path = current_path(conn)
    auth_page? = String.starts_with?(path, ["/login", "/signup", "/confirm"])

    if logged_in? || auth_page? do
      conn
    else
      put_session(conn, :user_return_to, path)
    end
  end

  def maybe_store_return_to(conn, _opts), do: conn

  @doc """
  Puts the given token in the session and sets the
  `:live_socket_id` key, so LiveView sessions are
  identified and automatically disconnected on log out.
  """
  def put_token_in_session(conn, token) do
    conn
    |> put_session(:user_token, token)
    |> put_session(:live_socket_id, user_session_topic(token))
  end

  @doc """
  Disconnects existing sockets for the given tokens.
  """
  def disconnect_sessions(tokens) do
    Enum.each(tokens, fn %{token: token} ->
      ZoonkWeb.Endpoint.broadcast(user_session_topic(token), "disconnect", %{})
    end)
  end

  defp user_session_topic(token), do: "users_sessions:#{Base.url_encode64(token)}"

  @doc "Returns the path to redirect to after log in."
  def signed_in_path(_conn), do: ~p"/"

  defp build_scope(user, host) when is_binary(host) or is_nil(host) do
    org = Orgs.get_org_by_host(host)
    subscription = Billing.get_user_subscription(%Scope{user: user, org: org})

    %Scope{}
    |> Scope.set(user)
    |> Scope.set(org)
    |> Scope.set(Orgs.get_org_member(org, user))
    |> Scope.set(subscription)
  end

  defp build_scope(user, []), do: build_scope(user, nil)
  defp build_scope(user, [domain_header | _rest]), do: build_scope(user, domain_header)
end
