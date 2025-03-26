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
    get_profile_by_custom_domain(host) || get_profile_by_subdomain(host)
  end

  def get_profile_by_host(_host), do: nil

  defp get_profile_by_custom_domain(host) do
    Repo.get_by(OrgProfile, custom_domain: host)
  end

  defp get_profile_by_subdomain(host) do
    case String.split(host, ".") do
      [_single] -> nil
      [subdomain, _start | _end] -> Repo.get_by(OrgProfile, subdomain: subdomain)
      _invalid -> nil
    end
  end
end
