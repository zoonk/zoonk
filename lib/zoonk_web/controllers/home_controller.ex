defmodule ZoonkWeb.HomeController do
  use ZoonkWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
