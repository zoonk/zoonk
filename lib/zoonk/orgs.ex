defmodule Zoonk.Orgs do
  @moduledoc """
  The Orgs context.

  Zoonk is a multi-tenant application. Therefore, we
  need to keep track of organizations and their members.

  This context is responsible for managing organizations,
  their settings, and members.
  """
  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias Zoonk.Accounts.User
  alias Zoonk.Helpers
  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Orgs.OrgSettings
  alias Zoonk.Repo
  alias Zoonk.Scope

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
  Returns an `Ecto.Changeset{}` for tracking org settings changes.

  ## Examples

      iex> change_org_settings(org_settings, %{field: new_value})
      %Ecto.Changeset{data: %OrgSettings{}}
  """
  def change_org_settings(%OrgSettings{} = org_settings, attrs \\ %{}) do
    OrgSettings.changeset(org_settings, attrs)
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
    Multi.new()
    |> Multi.insert(:org, Org.changeset(%Org{}, attrs))
    |> Multi.insert(:settings, fn %{org: org} -> change_org_settings(%OrgSettings{}, %{org_id: org.id}) end)
    |> Repo.transaction()
    |> Helpers.get_changeset_from_transaction(:org)
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

  def get_org_by_host(_host), do: get_app_org()

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

  @doc """
  Gets an org member.

  ## Examples

      iex> get_org_member(%Org{}, %User{})
      %OrgMember{user_id: user.id, org_id: org.id}

      iex> get_org_member(%Org{}, nil)
      nil
  """
  def get_org_member(%Org{} = org, %User{} = user) do
    Repo.get_by(OrgMember, org_id: org.id, user_id: user.id)
  end

  def get_org_member(_org, _user), do: nil

  @doc """
  Gets org settings.

  Given a `Zoonk.Scope`, allows org admins to retrieve
  settings for their organization.

  ## Examples

      iex> get_org_settings(%Scope{org_member: %{role: :admin}})
      %OrgSettings{}

      iex> get_org_settings(%Scope{org_member: %{role: :member}})
      nil

      iex> get_org_settings(%Scope{org_id: nil})
      nil
  """
  def get_org_settings(%Scope{org_member: %{role: :admin}} = scope) do
    Repo.get_by(OrgSettings, org_id: scope.org.id)
  end

  def get_org_settings(_scope), do: nil
end
