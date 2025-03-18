defmodule Zoonk.HelpersTest do
  use Zoonk.DataCase, async: true

  import Zoonk.Helpers

  describe "to_snake_case/1" do
    test "converts a string with spaces to snake case" do
      assert to_snake_case("Hello World") == "hello_world"
    end

    test "converts a camel case string to snake case" do
      assert to_snake_case("HelloWorld") == "hello_world"
    end

    test "removes special characters and converts to snake case" do
      assert to_snake_case("Hello World!") == "hello_world"
    end

    test "handles single word strings" do
      assert to_snake_case("Hello") == "hello"
    end
  end
end
