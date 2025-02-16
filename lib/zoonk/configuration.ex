defmodule Zoonk.Configuration do
  @moduledoc """
  This module contains general configuration and constants for the application.
  You can use this module to store configuration that is shared across the application.
  """

  @doc """
  Returns the maximum age of a token in days.
  """
  def get_token_max_age_in_days, do: 365

  @doc """
  Returns the maximum age of a token in seconds.
  """
  def get_token_max_age_in_seconds, do: get_token_max_age_in_days() * 24 * 60 * 60
end
