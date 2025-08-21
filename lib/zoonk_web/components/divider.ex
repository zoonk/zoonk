defmodule ZoonkWeb.Components.Divider do
  @moduledoc """
  Provides the UI for rendering dividers with optional labels.

  The divider creates a horizontal line with an optional centered text label
  to separate content sections.
  """
  use Phoenix.Component

  attr :label, :string, required: true, doc: "The text to display in the center of the divider"
  attr :class, :string, default: nil, doc: "Additional CSS classes to apply to the divider"

  attr :background, :atom,
    values: [:default, :bg],
    default: :default,
    doc: "Background color class for the label. Should match the parent container's background."

  @doc """
  Renders a horizontal divider with an optional label.

  ## Examples

      <.divider label="Or continue with" />

      <.divider label="Custom divider" class="my-8" />

      <div class="bg-zk-card p-4">
        <div>Content above</div>
        <.divider label="Separator" background="bg-zk-card" />
        <div>Content below</div>
      </div>
  """
  def divider(assigns) do
    ~H"""
    <div aria-hidden="true" role="presentation" class={["relative my-4 w-full shrink-0", @class]}>
      <div class="absolute inset-0 flex items-center">
        <div class="border-zk-border w-full border-t" />
      </div>

      <div class="relative flex justify-center">
        <span class={[
          "text-zk-secondary-foreground/70 px-2 text-sm",
          @background == :default && "bg-zk-background",
          @background == :bg && "bg-zk-background"
        ]}>
          {@label}
        </span>
      </div>
    </div>
    """
  end
end
