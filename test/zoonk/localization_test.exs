defmodule Zoonk.LocalizationTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.Localization

  describe "list_languages/1" do
    test ":atom returns all language atoms" do
      atoms = Localization.list_languages(:atom)
      assert :en in atoms
      assert :zh_Hans in atoms
      assert :zh_Hant in atoms
      assert Enum.all?(atoms, &is_atom/1)
    end

    test ":string returns all language strings" do
      strings = Localization.list_languages(:string)
      assert "en" in strings
      assert "zh_Hans" in strings
      assert "zh_Hant" in strings
      assert Enum.all?(strings, &is_binary/1)
    end

    test ":options returns all language options as {name, code}" do
      options = Localization.list_languages(:options)
      assert {"English", "en"} in options
      assert {"简体中文", "zh_Hans"} in options
      assert {"繁體中文", "zh_Hant"} in options
      assert Enum.all?(options, fn {name, code} -> is_binary(name) and is_binary(code) end)
    end
  end

  describe "default_language/1" do
    test ":atom returns the default language as atom" do
      assert Localization.default_language(:atom) == :en
    end

    test ":string returns the default language as string" do
      assert Localization.default_language(:string) == "en"
    end
  end
end
