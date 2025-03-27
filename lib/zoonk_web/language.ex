defmodule ZoonkWeb.Language do
  @moduledoc """
  Plugs and LiveView hooks for setting the application language.
  """
  import Plug.Conn

  alias Zoonk.Accounts.User
  alias Zoonk.Config.LanguageConfig
  alias Zoonk.Scope

  @doc """
  Sets the application language.

  It works based on the user's preference or the session language,
  which is set by `ZoonkWeb.Plugs.Language`.

  ## `on_mount` arguments

    * `:set_app_language` - Sets the application language
      based on the user's preference or the session language.

  ## Examples
  Use the `live_session` of your router to invoke the on_mount callback:

      alias ZoonkWeb.Hooks

      live_session :my_liveview,
        on_mount: [{Hooks.Language, :set_app_language}] do
        # my code here
      end
  """
  def on_mount(:set_app_language, _params, session, socket) do
    user_language = get_user_language(socket.assigns.current_scope, session)
    Gettext.put_locale(Zoonk.Gettext, user_language)
    {:cont, socket}
  end

  defp get_user_language(nil, session), do: Map.get(session, "language")
  defp get_user_language(%Scope{user: %User{language: language}}, _session), do: Atom.to_string(language)

  @doc """
  Sets the session language based on user preferences or browser settings.

  If the user has a preferred language set in their profile, it is used.
  Otherwise, the language is determined from the `accept-language` header.

  The selected language is then stored in the session.
  """
  def set_session_language(%{assigns: %{current_scope: %Scope{user: %User{language: language}}}} = conn, _opts) do
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
  defp get_browser_language(_lang, false), do: LanguageConfig.get_default_language(:string)

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
  defp extract_primary_language([]), do: LanguageConfig.get_default_language(:string)

  defp primary_language_supported?(language) do
    :string
    |> LanguageConfig.list_languages()
    |> Enum.member?(language)
  end
end
