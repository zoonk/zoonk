defmodule Zoonk.Scope do
  @moduledoc """
  Defines the scope of the caller to be used throughout the app.

  This scope allows public interfaces to receive
  information about the caller, such as if the call is initiated from an
  end-user, and if so, which user. Additionally, such a scope can carry fields
  such as "super user" or other privileges for use as authorization, or to
  ensure specific code paths can only be accessed for a given scope.

  It is useful for logging as well as for scoping pubsub subscriptions and
  broadcasts when a caller subscribes to an interface or performs a particular
  action.

  Feel free to extend the fields on this struct to fit the needs of
  growing application requirements.
  """

  alias Zoonk.Accounts.User
  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember

  defstruct user: nil, org: nil, org_member: nil

  @doc """
  Sets the scope.

  ## Examples

      iex> Scope.set(scope, %Org{})
      %Scope{}

      iex> Scope.set(scope, %User{})
      %Scope{}

      iex> Scope.set(scope, %OrgMember{})
      %Scope{}
  """
  def set(%__MODULE__{} = scope, %Org{} = org), do: %{scope | org: org}
  def set(%__MODULE__{} = scope, %User{} = user), do: %{scope | user: user}
  def set(%__MODULE__{} = scope, %OrgMember{} = org_member), do: %{scope | org_member: org_member}
  def set(%__MODULE__{} = scope, nil), do: scope

  def set(%__MODULE__{} = scope), do: scope
end
