defmodule ZoonkWeb.Controllers.Legal do
  @moduledoc """
  Renders legal documents such as terms of use and privacy policy.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Configuration

  @legal_dir "priv/static/legal"

  def terms(conn, _opts) do
    language = get_language(conn)
    render_legal_page(conn, language, "terms")
  end

  def privacy(conn, _opts) do
    language = get_language(conn)
    render_legal_page(conn, language, "privacy")
  end

  defp get_language(%Plug.Conn{} = conn), do: get_session(conn, :language) || "en"

  # We use only a valid language, so it's safe to ignore Sobelow warnings
  # If a user tries to attack us with a file traversal, they will get the default page
  # sobelow_skip ["Traversal.FileModule", "XSS.HTML"]
  defp render_legal_page(conn, language, directory) do
    languages = Configuration.supported_language_strings()
    valid_language? = language in languages
    sanitized_language = if valid_language?, do: Path.basename(language), else: "en"
    sanitized_directory = Path.basename(directory)
    file_path = get_file_path(sanitized_directory, sanitized_language)

    if File.exists?(file_path) do
      html(conn, File.read!(file_path))
    else
      default_path = get_file_path(directory, "en")
      html(conn, File.read!(default_path))
    end
  end

  defp get_file_path(directory, language), do: Path.join([@legal_dir, directory, "#{language}.html"])
end
