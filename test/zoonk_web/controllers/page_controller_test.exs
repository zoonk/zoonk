defmodule ZoonkWeb.PageControllerTest do
  use ZoonkWeb.ConnCase

  test "GET /", %{conn: conn} do
    conn = get(conn, ~p"/")
    assert html_response(conn, 200) =~ "home"
  end
end
