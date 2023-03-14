defmodule ZoonkWeb.HomeController do
  use ZoonkWeb, :controller

  def home(conn, _params) do
    conn |> assign(:page_title, gettext("Home")) |> render(:home)
  end
end
