defmodule ZoonkWeb.Plugs.SetLanguage do
  @moduledoc """
  Get the browser's language and set it to the current session.
  """
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    conn
    |> get_browser_language()
    |> set_language(conn)
  end

  defp get_browser_language(conn) do
    case get_req_header(conn, "accept-language") do
      [language | _] ->
        String.split(language, "-")
        |> List.first()

      _ ->
        nil
    end
  end

  defp set_language(language, conn) do
    if language &&
         Enum.member?(Zoonk.Language.supported_languages_keys(), String.to_atom(language)) do
      put_session(conn, :language, language)
    else
      put_session(conn, :language, Zoonk.Language.supported_languages_keys() |> List.first())
    end
  end
end
