defmodule Zoonk.Orgs do
  @moduledoc """
  The Orgs context.

  Zoonk is a multi-tenant application. Therefore, we
  need to keep track of organizations and their members.

  This context is responsible for managing organizations,
  their profiles, and members.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Orgs.OrgProfile
  alias Zoonk.Repo

  @doc """
  Gets an organization profile by host value.

  ## Examples

      iex> get_profile_by_host("custom-domain.com")
      %OrgProfile{custom_domain: "custom-domain.com"}

      iex> get_profile_by_host("subdomain.zoonk.com")
      %OrgProfile{subdomain: "subdomain"}

      iex> get_profile_by_host("unknown.zoonk.com")
      nil

  """
  def get_profile_by_host(host) when is_binary(host) do
    # First try to find by exact custom domain match
    case Repo.get_by(OrgProfile, custom_domain: host) do
      nil ->
        # If no match, extract subdomain and try to find by subdomain
        case extract_subdomain(host) do
          nil -> nil
          subdomain -> Repo.get_by(OrgProfile, subdomain: subdomain)
        end

      profile ->
        profile
    end
  end

  def get_profile_by_host(_host), do: nil

  # Extracts subdomain from host (e.g. "subdomain" from "subdomain.zoonk.com")
  defp extract_subdomain(host) do
    case String.split(host, ".", parts: 2) do
      [subdomain, _rest] -> subdomain
      _invalid -> nil
    end
  end
end
