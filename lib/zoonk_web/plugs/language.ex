defmodule ZoonkWeb.Plugs.Language do
  @moduledoc """
  Sets the session language for a connection using the
  current user's preference or the browser's settings.

  If a user is logged in with a language preference,
  that value is saved to the session. Otherwise,
  the plug extracts the primary language from the
  `accept-language` header.

  If this language is not supported, the default language
  from the configuration is used.

  When using a LiveView, we also need to add proper `on_mount`
  hooks available in `ZoonkWeb.Hooks.Language`.

  ## Usage

  In your router, add the plug to the pipeline:

      import ZoonkWeb.Plugs.Language

      pipeline :browser do
        plug :set_session_language
      end
  """
  import Plug.Conn

  alias Zoonk.Configuration
  alias Zoonk.Scope

  @doc """
  Sets the session language based on user preferences or browser settings.

  If the user has a preferred language set in their profile, it is used.
  Otherwise, the language is determined from the `accept-language` header.

  The selected language is then stored in the session.
  """
  def set_session_language(%{assigns: %{current_scope: %Scope{} = scope}} = conn, _opts) do
    put_session(conn, :language, Atom.to_string(scope.user_identity.user.language))
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
  defp get_browser_language(_lang, false), do: Configuration.get_default_language(:string)

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
  defp extract_primary_language([]), do: Configuration.get_default_language(:string)

  defp primary_language_supported?(language) do
    :string
    |> Configuration.list_languages()
    |> Enum.member?(language)
  end
end
