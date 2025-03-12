defmodule Zoonk.Encrypted.Binary do
  @moduledoc """
  This module is used to encrypt and decrypt binary data using the `Cloak` library.
  """
  use Cloak.Ecto.Binary, vault: Zoonk.Vault, closure: true
end
