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

  def capture(event, %Scope{user: %User{} = user} = scope, attrs) do
    attrs = Map.put(attrs, :org_id, scope.org.id)
    capture(event, user, attrs)
  end

  def capture(event, %User{id: user_id}, attrs) do
    Task.start(fn ->
      PostHog.capture(event, user_id, attrs)
    end)
  end

  def capture(event, guest_user_id, attrs) when is_binary(guest_user_id) do
    Task.start(fn ->
      PostHog.capture(event, guest_user_id, attrs)
    end)
  end

  def capture(event, _distinct_id, attrs) do
    Task.start(fn ->
      PostHog.capture(event, "anonymous", attrs)
    end)
  end
end
