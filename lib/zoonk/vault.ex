defmodule Zoonk.Vault do
  @moduledoc """
  Implements `Cloak.Vault` for Zoonk.

  This allows us to use `Cloak` for encryption and decryption of sensitive data.
  """
  use Cloak.Vault, otp_app: :zoonk
end
