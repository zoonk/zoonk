defmodule Zoonk.Analytics do
  @moduledoc """
  Captures analytics events.
  """
  alias Zoonk.Accounts.User
  alias Zoonk.Analytics.PostHog
  alias Zoonk.Scope

  @doc """
  Captures an event with the given name, scope, and attributes.

  Then, we send these events to our analytics provider.
  """
  def capture(event, scope_or_user, attrs \\ %{})

  def capture(event, %Scope{} = scope, attrs) do
    attrs = Map.put(attrs, :org_id, scope.org.id)

    Task.start(fn ->
      PostHog.capture(event, get_user_id(scope), attrs)
    end)
  end

  def capture(event, %User{id: user_id}, attrs) do
    Task.start(fn ->
      PostHog.capture(event, user_id, attrs)
    end)
  end

  defp get_user_id(%Scope{user: nil}), do: "guest_#{System.unique_integer()}"
  defp get_user_id(%Scope{user: user}), do: user.id
end
