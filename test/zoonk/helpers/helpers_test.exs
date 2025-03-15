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

  describe "normalize_keys/1" do
    test "normalizes string keys to atoms" do
      assert normalize_keys(%{"hello" => "world"}) == %{hello: "world"}
    end

    test "keeps atom keys as is" do
      assert normalize_keys(%{hello: "world"}) == %{hello: "world"}
    end

    test "normalizes keys with spaces to snake case" do
      assert normalize_keys(%{"Hello World" => "test"}) == %{hello_world: "test"}
    end

    test "normalizes mixed keys to snake case" do
      assert normalize_keys(%{"Hello World" => "test", hello: "world"}) == %{hello_world: "test", hello: "world"}
    end
  end
end
