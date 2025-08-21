defmodule ZoonkWeb.Components.Toggle do
  @moduledoc """
  Provides the UI for rendering toggle components.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  @doc """
  Renders a toggle group container.

  ## Examples

      <.toggle_group phx-change="update_view">
        <.toggle_item name="view" value="list">List</.toggle_item>
        <.toggle_item name="view" value="grid">Grid</.toggle_item>
      </.toggle_group>
  """
  attr :class, :string, default: nil
  attr :rest, :global

  slot :inner_block, required: true

  def toggle_group(assigns) do
    ~H"""
    <form
      class={["shadow-xs border-zk-border flex w-fit items-center rounded-md border", @class]}
      role="radiogroup"
      {@rest}
    >
      {render_slot(@inner_block)}
    </form>
    """
  end

  @doc """
  Renders a toggle item within a toggle group.

  This component uses radio inputs for semantic correctness and accessibility.

  ## Examples

      <.toggle_item name="option1" value="option1">Option 1</.toggle_item>
      <.toggle_item name="option2" value="option2" icon="tabler-grid">Grid View</.toggle_item>
  """
  attr :value, :string, required: true
  attr :name, :string, required: true
  attr :checked, :boolean, default: false
  attr :icon, :string, default: nil
  attr :class, :string, default: nil

  slot :inner_block, required: true

  def toggle_item(assigns) do
    ~H"""
    <label class="group flex-1">
      <input type="radio" name={@name} value={@value} checked={@checked} class="peer sr-only" />

      <span class={[
        "min-h-0 min-w-0 flex-1 px-2 py-1.5",
        "flex shrink-0 items-center justify-center gap-2",
        "text-zk-foreground text-sm font-medium capitalize",
        "bg-zk-background shadow-xs select-none",
        "border-zk-border border-l",
        "group-first:rounded-l-md group-first:border-l-0 group-last:rounded-r-md",
        "hover:bg-zk-muted",
        "peer-checked:bg-zk-secondary peer-checked:text-zk-secondary-foreground",
        "peer-focus-visible:outline-2",
        @class
      ]}>
        <.icon :if={@icon} name={@icon} class="size-4 shrink-0" />
        {render_slot(@inner_block)}
      </span>
    </label>
    """
  end
end
