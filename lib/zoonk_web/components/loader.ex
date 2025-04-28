defmodule ZoonkWeb.Components.Loader do
  @moduledoc """
  Loader components.

  Minimalist pulsing dot loader component for subtle loading states.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  @doc """
  Renders a pulsing dot loader.

  ## Examples

      <.loader />
      <.loader size={:md} />
      <.loader variant={:sky} />
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the loader"
  attr :size, :atom, values: [:xs, :sm, :md, :lg, :xl], default: :sm, doc: "Size of the loader"
  attr :rest, :global, doc: "Additional HTML attributes"

  def loader(assigns) do
    ~H"""
    <div
      role="status"
      aria-label={gettext("Loading")}
      class={["bg-zk-primary animate-zk-pulse rounded-full", size_class(@size), @class]}
      {@rest}
    />
    """
  end

  defp size_class(:xs), do: "size-1.5"
  defp size_class(:sm), do: "size-2.5"
  defp size_class(:md), do: "size-4"
  defp size_class(:lg), do: "size-6"
  defp size_class(:xl), do: "size-8"
end
