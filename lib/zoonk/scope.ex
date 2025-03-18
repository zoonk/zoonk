defmodule Zoonk.Scope do
  @moduledoc """
  Defines the scope of the caller to be used throughout the app.

  The `Zoonk.Scope` allows public interfaces to receive
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

  alias Zoonk.Schemas.UserIdentity

  defstruct user_identity: nil

  @doc """
  Creates a scope for the given user identity.

  Returns nil if no user identity is given.
  """
  def for_user(%UserIdentity{} = user_identity) do
    %__MODULE__{user_identity: user_identity}
  end

  def for_user(nil), do: nil

  @doc """
  Shortcut for getting a `%Zoonk.Schemas.User{}` from scope.
  """
  def get_user(%{user_identity: %UserIdentity{user: user}}), do: user
  def get_user(nil), do: nil
end
