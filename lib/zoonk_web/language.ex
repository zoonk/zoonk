defmodule ZoonkWeb.Language do
  @moduledoc """
  Handles language detection and setting for the application.

  This module ensures that the application language is
  properly set based on user preferences, session data,
  or browser settings.

  ## Features:
    - Detects and sets the language on mount.
    - Persists language preferences in the session.
    - Retrieves language from the user's profile if available.
    - Falls back to the browser's preferred language or
    the default application language.

  ## Usage:

  Use the `set_session_language` plug in your router pipeline
  to set the language for the current session.


      import ZoonkWeb.Language

      pipeline :browser do
        plug :set_session_language
      end

  Then, use the `on_mount` lifecycle macro in LiveViews to set
  the language based on the user's preferences or current session.

      live_session :public_view, on_mount: [{ZoonkWeb.Language, :set_app_language}]
  """
  import Plug.Conn

  alias Zoonk.Configuration

  def on_mount(:set_app_language, _params, session, socket) do
    user = socket.assigns.current_user
    language = if user, do: Atom.to_string(user.language), else: Map.get(session, "language")
    Gettext.put_locale(ZoonkWeb.Gettext, language)
    {:cont, socket}
  end

  def set_session_language(%{assigns: %{current_user: %{language: language}}} = conn, _opts) do
    set_app_language(conn, Atom.to_string(language))
  end

  def set_session_language(conn, _opts) do
    set_app_language(conn, get_browser_language(conn))
  end

  defp set_app_language(conn, language) do
    Gettext.put_locale(ZoonkWeb.Gettext, language)
    put_session(conn, :language, language)
  end

  defp get_browser_language(conn) do
    language =
      conn
      |> get_req_header("accept-language")
      |> extract_primary_language()

    # Convert the atom list to a string list
    supported = Enum.map(Configuration.supported_language_keys(), fn language -> Atom.to_string(language) end)

    if Enum.member?(supported, language), do: language, else: Configuration.default_language_string()
  end

  # Parse the `accept-language` header and extract the first language there.
  defp extract_primary_language([accept_language | _rest]) do
    accept_language
    |> String.split("-")
    |> List.first()
  end

  defp extract_primary_language([]), do: Configuration.default_language_string()
end
