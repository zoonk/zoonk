defmodule ZoonkWeb.Language do
  @moduledoc """
  Handles language detection and setting for the application.

  This module ensures that the application language is
  properly set based on user preferences, session data,
  or browser settings.

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
  alias Zoonk.Schema.User

  def on_mount(:set_app_language, _params, session, socket) do
    user_language = get_user_language(socket.assigns.current_user, session)
    Gettext.put_locale(ZoonkWeb.Gettext, user_language)
    {:cont, socket}
  end

  defp get_user_language(nil, session), do: Map.get(session, "language")
  defp get_user_language(%User{language: language}, _session), do: Atom.to_string(language)

  @doc """
  Sets the session language based on user preferences or browser settings.

  If the user has a preferred language set in their profile, it is used.
  Otherwise, the language is determined from the `accept-language` header.

  The selected language is then stored in the session.
  """
  def set_session_language(%{assigns: %{current_user: %{language: language}}} = conn, _opts) do
    put_session(conn, :language, Atom.to_string(language))
  end

  def set_session_language(%Plug.Conn{} = conn, _opts) do
    put_session(conn, :language, get_browser_language(conn))
  end

  defp get_browser_language(%Plug.Conn{} = conn) do
    language = extract_primary_language(conn)
    get_browser_language(language, primary_language_supported?(language))
  end

  # Use the browser's preferred language if it is supported.
  defp get_browser_language(language, true), do: language

  # Fallback to the default language if the browser's preferred language is not supported.
  defp get_browser_language(_lang, false), do: Configuration.default_language_string()

  # Extract the primary language from the `accept-language` header.
  defp extract_primary_language(%Plug.Conn{} = conn) do
    extract_primary_language(get_req_header(conn, "accept-language"))
  end

  # Parse the `accept-language` header and extract the first language there.
  defp extract_primary_language([accept_language | _rest]) do
    accept_language
    |> String.split("-")
    |> List.first()
  end

  # Fallback to the default language if the `accept-language` header is not present.
  defp extract_primary_language([]), do: Configuration.default_language_string()

  defp primary_language_supported?(language) do
    Enum.member?(Configuration.supported_language_strings(), language)
  end
end
