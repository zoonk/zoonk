defmodule Zoonk.Config.AuthConfig do
  @moduledoc """
  Manages authentication-related configurations for the application.

  This module centralizes all authentication settings used throughout
  the application, ensuring consistency and ease of maintenance.
  """

  @doc """
  Returns the default hash algorithm.

  ## Example

      iex> get_hash_algorithm()
      :sha256
  """
  def get_hash_algorithm, do: :sha256

  @doc """
  Returns the maximum age or validity of an item.

  For magic link tokens, it is very important to keep their expiry short,
  since someone with access to the email may take over the account.

  ## Example

      iex> get_max_age(:token, :days)
      365

      iex> get_max_age(:token, :seconds)
      31536000

      iex> get_max_age(:magic_link, :minutes)
      15

      iex> get_max_age(:change_email, :days)
      7

      iex> get_max_age(:sudo_mode, :minutes)
      -10
  """
  def get_max_age(:token, :days), do: 365
  def get_max_age(:token, :seconds), do: get_max_age(:token, :days) * 24 * 60 * 60
  def get_max_age(:magic_link, :minutes), do: 15
  def get_max_age(:change_email, :days), do: 7
  def get_max_age(:sudo_mode, :minutes), do: -10

  @doc """
  Returns the name of a cookie.

  ## Example

      iex> get_cookie_name(:remember_me)
      "_zoonk_web_user_remember_me"
  """
  def get_cookie_name(:remember_me), do: "_zoonk_web_user_remember_me"

  @doc """
  Returns a list of supported oAuth providers.

  ## Example

      iex> list_providers()
      [:apple, :github, :google]
  """
  def list_providers, do: [:apple, :github, :google]
end
