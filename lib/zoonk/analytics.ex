defmodule Zoonk.Analytics do
  @moduledoc """
  Captures analytics events.
  """
  alias Zoonk.Scope

  @doc """
  Captures an event with the given name, scope, and attributes.

  Then, we send these events to our analytics provider.
  """
  def capture(event, %Scope{} = scope, attrs \\ %{}) do
    attrs = Map.put(attrs, :org_id, scope.org.id)

    Task.start(fn ->
      try do
        Posthog.capture(event, get_user_id(scope), attrs)
      rescue
        _error -> :error
      end
    end)
  end

  defp get_user_id(%Scope{user: nil}), do: nil
  defp get_user_id(%Scope{user: user}), do: user.id
end
