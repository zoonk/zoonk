defmodule Zoonk.Config.AuthConfig do
  @moduledoc """
  Manages authentication-related configurations for the application.

  This module centralizes all authentication settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """

  @doc """
  Returns the `rand` number of bytes to use for generating tokens.

  This is used with `:crypto.strong_rand_bytes`.

    ## Example

        iex> get_rand_size()
        32
  """
  def get_rand_size, do: 32

  @doc """
  Returns the maximum age or validity of an item.

  For OTP codes, it is very important to keep their expiry short,
  since someone with access to the email may take over the account.

  ## Example

      iex> get_max_age(:token, :days)
      365

      iex> get_max_age(:token, :seconds)
      31536000

      iex> get_max_age(:otp, :minutes)
      15

      iex> get_max_age(:change_email, :days)
      7

      iex> get_max_age(:sudo_mode, :minutes)
      -10
  """
  def get_max_age(:token, :days), do: 365
  def get_max_age(:token, :seconds), do: get_max_age(:token, :days) * 24 * 60 * 60
  def get_max_age(:otp, :minutes), do: 15
  def get_max_age(:change_email, :days), do: 7
  def get_max_age(:sudo_mode, :minutes), do: -10

  # How old the session token should be before a new one is issued. When a request is made
  # with a session token older than this value, then a new session token will be created
  # and the session and remember-me cookies (if set) will be updated with the new token.
  # Lowering this value will result in more tokens being created by active users. Increasing
  # it will result in less time before a session token expires for a user to get issued a new
  # token. This can be set to a value greater than `get_max_age(:token, :days)` to disable
  # the reissuing of tokens completely.
  def get_max_age(:session_token, :days), do: 7
end
