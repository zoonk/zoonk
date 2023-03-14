defmodule ZoonkWeb.AgeController do
  use ZoonkWeb, :controller

  def index(conn, _params) do
    conn |> assign(:page_title, dgettext("auth", "Restricted access")) |> render(:age)
  end
end
