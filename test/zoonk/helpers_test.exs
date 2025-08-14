defmodule Zoonk.HelpersTest do
  use Zoonk.DataCase, async: true

  import Zoonk.Helpers

  describe "remove_accents/1" do
    test "removes accents from Latin characters" do
      assert remove_accents("Café") == "Cafe"
      assert remove_accents("Crème brûlée") == "Creme brulee"
      assert remove_accents("naïve") == "naive"
    end

    test "handles strings without accents" do
      assert remove_accents("Hello World") == "Hello World"
      assert remove_accents("Testing 123") == "Testing 123"
    end

    test "removes other diacritical marks" do
      assert remove_accents("piñata") == "pinata"
      assert remove_accents("São Paulo") == "Sao Paulo"
      assert remove_accents("über") == "uber"
    end

    test "removes special characters" do
      assert remove_accents("café@home") == "cafehome"
      assert remove_accents("test#123") == "test123"
      assert remove_accents("hello-world") == "helloworld"
    end

    test "preserves alphanumeric characters and spaces" do
      assert remove_accents("Café 123") == "Cafe 123"
      assert remove_accents("Hello World 2025") == "Hello World 2025"
    end
  end

  describe "with_decoded_token/3" do
    test "applies the function to a successfully decoded token" do
      # "hello" encoded as URL-safe Base64
      encoded_token = "aGVsbG8"

      result =
        with_decoded_token(encoded_token, fn decoded ->
          assert decoded == "hello"
          String.upcase(decoded)
        end)

      assert result == "HELLO"
    end

    test "returns :error for invalid Base64 encoding" do
      invalid_token = "not-valid-base64!"

      result =
        with_decoded_token(invalid_token, fn _decoded ->
          flunk("This function should not be called")
        end)

      assert result == :error
    end

    test "returns custom error when a third argument is provided" do
      invalid_token = "not-valid-base64!"

      result =
        with_decoded_token(
          invalid_token,
          fn _decoded ->
            flunk("This function should not be called")
          end,
          nil
        )

      assert is_nil(result)
    end

    test "works with more complex functions" do
      # "token:123" encoded as URL-safe Base64
      encoded_token = "dG9rZW46MTIz"

      result =
        with_decoded_token(encoded_token, fn decoded ->
          [prefix, number] = String.split(decoded, ":")
          {prefix, String.to_integer(number)}
        end)

      assert result == {"token", 123}
    end
  end

  describe "to_existing_atom/1" do
    test "converts a string to an existing atom" do
      assert to_existing_atom("catalog") == :catalog
      assert to_existing_atom("accounts") == :accounts
    end

    test "returns nil for non-existent atoms" do
      assert to_existing_atom("non_existent_atom") == nil
    end

    test "returns nil when the input is nil" do
      assert to_existing_atom(nil) == nil
    end

    test "does not create new atoms" do
      random_string = "random_#{System.unique_integer([:positive])}"
      assert to_existing_atom(random_string) == nil
    end

    test "returns the same atom when passing an atom" do
      assert to_existing_atom(:catalog) == :catalog
      assert to_existing_atom(:accounts) == :accounts
    end
  end

  describe "to_existing_atom/2" do
    test "pass a default value to be used when is nil" do
      assert to_existing_atom(nil, :default) == :default
      assert to_existing_atom("catalog", :default) == :catalog
      assert to_existing_atom("non_existent_atom", :default) == :default
    end
  end

  describe "maybe_put/3" do
    test "adds key-value pair to empty map" do
      assert maybe_put(%{}, "key", "value") == %{"key" => "value"}
    end

    test "adds key-value pair to existing map" do
      map = %{"existing" => "data"}
      result = maybe_put(map, "new_key", "new_value")
      assert result == %{"existing" => "data", "new_key" => "new_value"}
    end

    test "returns unchanged map when value is nil" do
      map = %{"existing" => "data"}
      assert maybe_put(map, "key", nil) == map
    end

    test "returns unchanged map when value is empty string" do
      map = %{"existing" => "data"}
      assert maybe_put(map, "key", "") == map
    end

    test "handles atom keys" do
      assert maybe_put(%{}, :key, "value") == %{key: "value"}
    end

    test "overwrites existing key" do
      map = %{"key" => "old_value"}
      result = maybe_put(map, "key", "new_value")
      assert result == %{"key" => "new_value"}
    end
  end

  describe "to_lowercase_existing_atom/1" do
    test "converts uppercase string to existing atom" do
      assert to_lowercase_existing_atom("CATALOG") == :catalog
      assert to_lowercase_existing_atom("ACCOUNTS") == :accounts
    end

    test "converts lowercase string to existing atom" do
      assert to_lowercase_existing_atom("catalog") == :catalog
      assert to_lowercase_existing_atom("accounts") == :accounts
    end

    test "returns nil for non-existent atoms" do
      assert to_lowercase_existing_atom("NON_EXISTENT_ATOM") == nil
      assert to_lowercase_existing_atom("non_existent_atom") == nil
    end

    test "returns nil when the input is nil" do
      assert to_lowercase_existing_atom(nil) == nil
    end

    test "returns the same atom when passing an atom" do
      assert to_lowercase_existing_atom(:catalog) == :catalog
      assert to_lowercase_existing_atom(:accounts) == :accounts
    end

    test "converts mixed-case string to existing atom" do
      assert to_lowercase_existing_atom("CaTaLoG") == :catalog
      assert to_lowercase_existing_atom("AccOuNtS") == :accounts
    end
  end
end
