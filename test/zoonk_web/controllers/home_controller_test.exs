defmodule ZoonkWeb.HomeControllerTest do
  @moduledoc false

  use ZoonkWeb.ConnCase
  import Zoonk.AccountsFixtures

  describe "GET /" do
    test "renders the correct language attribute", %{conn: conn} do
      result = conn |> log_in_user(user_fixture(language: :pt)) |> get(~p"/")
      assert html_response(result, 200) =~ ~s'<html lang="pt">'
    end
  end
end
