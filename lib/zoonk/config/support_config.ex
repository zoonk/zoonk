defmodule Zoonk.Config.SupportConfig do
  @moduledoc """
  Configuration values for support-related features.

  This module centralizes support configuration to ensure consistency
  across the application when referencing support timelines and contact information.
  """

  @doc """
  Returns the number of business days for support response time.

  ## Examples

      iex> Zoonk.Config.SupportConfig.response_time_days()
      3
  """
  def response_time_days, do: 3

  @doc """
  Returns the support email address.

  ## Examples

      iex> Zoonk.Config.SupportConfig.support_email()
      "hello@zoonk.com"
  """
  def support_email, do: "hello@zoonk.com"

  @doc """
  Returns the billing email address.

  ## Examples

      iex> Zoonk.Config.SupportConfig.billing_email()
      "billing@zoonk.com"
  """
  def billing_email, do: "billing@zoonk.com"
end
