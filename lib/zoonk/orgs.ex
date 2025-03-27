defmodule Zoonk.Orgs do
  @moduledoc """
  The Orgs context.

  Zoonk is a multi-tenant application. Therefore, we
  need to keep track of organizations and their members.

  This context is responsible for managing organizations,
  their settings, and members.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Orgs.Org
  alias Zoonk.Repo

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking org changes.

  ## Examples

      iex> change_org(org, %{field: new_value})
      %Ecto.Changeset{data: %Org{}}
  """
  def change_org(%Org{} = org, attrs \\ %{}) do
    Org.changeset(org, attrs)
  end

  @doc """
  Creates an organization.

  ## Examples

      iex> create_org(%{name: "My Org", subdomain: "my-org"})
      {:ok, %Org{}}

      iex> create_org(%{name: "My Org"})
      {:error, %Ecto.Changeset{}}
  """
  def create_org(attrs \\ %{}) do
    %Org{}
    |> change_org(attrs)
    |> Repo.insert()
  end

  @doc """
  Gets an organization by host value.

  ## Examples

      iex> get_org_by_host("custom-domain.com")
      %Org{custom_domain: "custom-domain.com"}

      iex> get_org_by_host("subdomain.zoonk.com")
      %Org{subdomain: "subdomain"}

      iex> get_org_by_host("unknown.zoonk.com")
      nil

  """
  def get_org_by_host(host) when is_binary(host) do
    get_org_by_custom_domain(host) || get_org_by_subdomain(host) || get_app_org()
  end

  def get_org_by_host(_host), do: nil

  defp get_org_by_custom_domain(host) do
    Repo.get_by(Org, custom_domain: host)
  end

  defp get_org_by_subdomain(host) do
    case String.split(host, ".") do
      [_single] -> nil
      [subdomain, _start | _end] -> Repo.get_by(Org, subdomain: subdomain)
      _invalid -> nil
    end
  end

  # Fallback if we couldn't find an org, then use the app org
  # (which is the only one that can be used without a subdomain)
  # because everyone has access to the main app.
  defp get_app_org do
    Repo.get_by(Org, kind: :app)
  end
end
