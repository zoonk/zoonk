defmodule Zoonk.ValidationData.SubdomainValidationData do
  @moduledoc """
  This module contains test data for subdomain validation.
  """

  @doc """
  Returns a list of valid subdomains for testing purposes.

  ## Examples

      iex> Zoonk.ValidationData.SubdomainValidationData.valid_subdomains()
      ["myorg", "my-org", ...]
  """
  def valid_subdomains do
    [
      "myorg",
      "my-org",
      "my_org",
      "myorg123",
      "123myorg",
      "my-org-123",
      "my_org_123",
      "MY-ORG",
      "MY_ORG",
      "MYORG123",
      "m",
      "1",
      "_",
      "-"
    ]
  end

  @doc """
  Returns a list of invalid subdomains for testing purposes.

  ## Examples

      iex> Zoonk.ValidationData.SubdomainValidationData.invalid_subdomains()
      ["my.org", "my@org", ...]
  """
  def invalid_subdomains do
    [
      "my.org",
      "my@org",
      "my/org",
      "my\\org",
      "my:org",
      "my;org",
      "my,org",
      "my org",
      "my+org",
      "my=org",
      "my&org",
      "my%org",
      "my$org",
      "my#org",
      "my!org",
      "my*org",
      "my(org)",
      "my[org]",
      "my{org}",
      "my|org",
      "my\"org\"",
      "my'org'",
      "my`org`",
      "my~org",
      "my<org>",
      "my?org"
    ]
  end

  @doc """
  Returns a list of subdomains with spaces for testing purposes.

  ## Examples

      iex> Zoonk.ValidationData.SubdomainValidationData.space_subdomains()
      [" myorg", "myorg ", " myorg "]
  """
  def space_subdomains do
    [
      " myorg",
      "myorg ",
      " myorg "
    ]
  end
end
