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
  alias Zoonk.Config.AuthConfig
  alias Zoonk.Helpers
  alias Zoonk.Orgs
  alias Zoonk.Orgs.Org
  alias Zoonk.Scope

  @max_age AuthConfig.get_max_age(:token, :seconds)
  @remember_me_cookie AuthConfig.get_cookie_name(:remember_me)
  @remember_me_options [sign: true, max_age: @max_age, same_site: "Lax"]

  @public_paths ["/catalog"]
  @public_contexts [:catalog, :onboarding]

  @doc """
  Logs the user in.

  It renews the session ID and clears the whole session
  to avoid fixation attacks. See the renew_session
  function to customize this behaviour.

  It also sets a `:live_socket_id` key in the session,
  so LiveView sessions are identified and automatically
  disconnected on log out. The line can be safely removed
  if you are not using LiveView.

  In case the user re-authenticates for sudo mode,
  the existing remember_me setting is kept, writing a new remember_me cookie.
  """
  def login_user(conn, user) do
    token = Accounts.generate_user_session_token(user)
    user_return_to = get_session(conn, :user_return_to)

    conn
    |> renew_session()
    |> put_token_in_session(token)
    |> write_remember_me_cookie(token)
    |> redirect(to: user_return_to || signed_in_path(conn))
  end

  defp write_remember_me_cookie(conn, token) do
    conn
    |> put_session(:user_remember_me, true)
    |> put_resp_cookie(@remember_me_cookie, token, @remember_me_options)
  end

  # This function renews the session ID and erases the whole
  # session to avoid fixation attacks. If there is any data
  # in the session you may want to preserve after log in/log out,
  # you must explicitly fetch the session data before clearing
  # and then immediately set it after clearing, for example:
  #
  #     defp renew_session(conn) do
  #       preferred_locale = get_session(conn, :preferred_locale)
  #
  #       conn
  #       |> configure_session(renew: true)
  #       |> clear_session()
  #       |> put_session(:preferred_locale, preferred_locale)
  #     end
  #
  defp renew_session(conn) do
    delete_csrf_token()

    conn
    |> configure_session(renew: true)
    |> clear_session()
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
    |> renew_session()
    |> delete_resp_cookie(@remember_me_cookie)
    |> redirect(to: ~p"/")
  end

  @doc """
  Authenticates the user by looking into the session
  and remember me token.
  """
  def fetch_scope(conn, _opts) do
    {user_token, conn} = ensure_user_token(conn)
    user = user_token && Accounts.get_user_by_session_token(user_token)
    assign(conn, :scope, build_scope(user, conn.host))
  end

  defp ensure_user_token(conn) do
    if token = get_session(conn, :user_token) do
      {token, conn}
    else
      conn = fetch_cookies(conn, signed: [@remember_me_cookie])

      if token = conn.cookies[@remember_me_cookie] do
        {token, put_token_in_session(conn, token)}
      else
        {nil, conn}
      end
    end
  end

  @doc """
  Handles mounting and authenticating the scope in LiveViews.

  ## `on_mount` arguments

    * `:mount_scope` - Assigns scope
      to socket assigns based on user_token, or nil if
      there's no user_token or no matching user.

    * `:ensure_authenticated` - Authenticates the user from the session,
      and assigns the scope to socket assigns
      based on user_token. Redirects to login page if there's no logged user.

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

  def on_mount(:ensure_authenticated, _params, session, socket) do
    socket = mount_scope(socket, session)
    context = Helpers.get_context_from_module(socket.view)
    logged_in? = socket.assigns.scope && socket.assigns.scope.user

    if public_context?(context) or logged_in? do
      {:cont, socket}
    else
      socket = Phoenix.LiveView.redirect(socket, to: unauthenticated_path(socket.assigns.scope, nil))

      {:halt, socket}
    end
  end

  def on_mount(:ensure_sudo_mode, _params, session, socket) do
    socket = mount_scope(socket, session)

    if Accounts.sudo_mode?(socket.assigns.scope.user) do
      {:cont, socket}
    else
      socket =
        socket
        |> Phoenix.LiveView.put_flash(:error, dgettext("users", "You need to reauthenticate to access this page."))
        |> Phoenix.LiveView.redirect(to: ~p"/login")

      {:halt, socket}
    end
  end

  defp mount_scope(socket, session) do
    Phoenix.Component.assign_new(socket, :scope, fn ->
      user =
        if user_token = session["user_token"] do
          Accounts.get_user_by_session_token(user_token)
        end

      %URI{host: host} = Phoenix.LiveView.get_connect_info(socket, :uri)
      build_scope(user, host)
    end)
  end

  @doc """
  Used for routes that require the user to be authenticated.

  If you want to enforce the user email is confirmed before
  they use the application at all, here would be a good place.
  """
  def require_authenticated_user(conn, _opts) do
    logged_in? = conn.assigns.scope && conn.assigns.scope.user

    if public_path?(conn.request_path) or logged_in? do
      conn
    else
      conn
      |> maybe_store_return_to()
      |> redirect(to: unauthenticated_path(conn.assigns.scope, conn.request_path))
      |> halt()
    end
  end

  defp maybe_store_return_to(%{method: "GET"} = conn) do
    put_session(conn, :user_return_to, current_path(conn))
  end

  defp maybe_store_return_to(conn), do: conn

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
  # the user was already logged in, redirect to settings
  def signed_in_path(%Plug.Conn{assigns: %{scope: %Scope{user: %User{}}}}) do
    ~p"/user/email"
  end

  def signed_in_path(_conn), do: ~p"/"

  defp unauthenticated_path(_scope, "/user" <> _rest), do: ~p"/login"
  defp unauthenticated_path(%Scope{org: %Org{kind: :app}}, _path), do: ~p"/start"
  defp unauthenticated_path(%Scope{org: %Org{kind: :creator}}, _path), do: ~p"/catalog"
  defp unauthenticated_path(_scope, _path), do: ~p"/login"

  defp build_scope(user, host) do
    org = Orgs.get_org_by_host(host)

    %Scope{}
    |> Scope.set(user)
    |> Scope.set(org)
    |> Scope.set(Orgs.get_org_member(org, user))
  end

  defp public_context?(nil), do: false

  defp public_context?(context) do
    Enum.member?(@public_contexts, context)
  end

  defp public_path?(path) do
    Enum.any?(@public_paths, fn public_path -> String.starts_with?(path, public_path) end)
  end
end
