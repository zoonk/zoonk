defmodule ZoonkWeb.Components.Spinner do
  @moduledoc """
  Spinner component for indicating loading states.

  This component provides a visual indicator for loading or processing operations
  in the application. Use it whenever the system is performing an asynchronous
  operation and the user needs visual feedback.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  @doc """
  Renders a spinner with customizable size and color.

  ## Examples

      <.spinner />
      <.spinner variant={:secondary} />
      <.spinner size={:sm} />

  ## Attributes

  - `class` - Additional CSS classes to apply to the spinner
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the spinner"

  attr :variant, :atom,
    values: [:primary, :secondary, :white],
    default: :primary,
    doc: "Variant of the spinner"

  attr :size, :atom,
    values: [:xs, :sm, :md, :lg, :xl, :xxl],
    default: :sm

  attr :rest, :global, doc: "Additional HTML attributes"

  def spinner(assigns) do
    ~H"""
    <div
      class={[
        "animate-spin rounded-full border-t-2",
        @variant == :primary && "border-zk-primary",
        @variant == :secondary && "border-zk-secondary-accent",
        @variant == :white && "border-white",
        @size == :xs && "size-4",
        @size == :sm && "size-8",
        @size == :md && "size-12",
        @size == :lg && "size-16",
        @size == :xl && "size-20",
        @size == :xxl && "size-24",
        @class
      ]}
      role="status"
      aria-label={gettext("Loading")}
      {@rest}
    >
    </div>
    """
  end
end
