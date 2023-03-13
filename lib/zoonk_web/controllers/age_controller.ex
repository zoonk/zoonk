defmodule ZoonkWeb.AgeController do
  use ZoonkWeb, :controller

  def index(conn, _params) do
    render(conn, :age, layout: false)
  end
end
