defmodule Zoonk.Encrypted.Binary do
  @moduledoc false
  use Cloak.Ecto.Binary, vault: Zoonk.Vault, closure: true
end
