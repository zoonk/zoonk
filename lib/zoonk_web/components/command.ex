defmodule ZoonkWeb.Components.Command do
  @moduledoc """
  Components for rendering command dialogs.

  Command dialogs can often be accessible via keyboard
  shortcuts such as `Cmd + K` or `Ctrl + K`.

  This module provides a way to create command dialogs
  that can be triggered by these shortcuts.

  They can be useful for searching or executing
  commands quickly without navigating through menus or buttons.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Icon

  @doc """
  Renders a button that looks like a search input field.

  It can be used to trigger a command dialog when clicked.
  It also implements the `Cmd + K` or `Ctrl + K`
  keyboard shortcuts to open the dialog.

  ## Examples

      <.command_trigger label="Search..." dialog_id="search-dialog" />
      <.command_trigger label="Find commands..." dialog_id="commands-dialog" shortcut="p" />
  """
  attr :id, :string, default: "command-trigger", doc: "The unique identifier for the button"
  attr :label, :string, default: gettext("Search..."), doc: "Text to display in the button"
  attr :dialog_id, :string, default: "command-dialog", doc: "ID of the dialog to open"
  attr :class, :string, default: nil, doc: "Additional CSS classes for the button"
  attr :shortcut, :string, default: "k", doc: "Keyboard shortcut key to open the dialog"
  attr :rest, :global, doc: "Additional HTML attributes for the button"

  def command_trigger(assigns) do
    ~H"""
    <button
      id={@id}
      aria-haspopup="dialog"
      aria-controls={@dialog_id}
      phx-hook="DialogTrigger"
      data-dialog-id={@dialog_id}
      data-shortcut={@shortcut}
      class={[
        "bg-zk-muted text-zk-muted-foreground/70 flex w-full items-center justify-between gap-2",
        "border-zk-border rounded border py-1.5 pr-1.5 pl-2 text-sm",
        "hover:bg-zk-secondary focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-zk-primary focus-visible:ring-offset-2",
        @class
      ]}
      {@rest}
    >
      <span class="inline-flex items-center gap-2">
        <.icon name="tabler-search" class="size-4" />
        <span>{@label}</span>
      </span>

      <kbd
        aria-label={gettext("Shortcut:")}
        class="bg-zk-surface border-zk-border text-2xs pointer-events-none hidden gap-1 rounded-sm border px-1.5 py-0.5 uppercase md:flex"
      >
        <kbd>⌘</kbd>
        <kbd>{@shortcut}</kbd>
      </kbd>
    </button>
    """
  end

  @doc """
  Renders a styled input field for command dialogs with an icon.

  This component provides a standardized input field used in command dialogs,
  featuring a search icon and consistent styling.

  ## Examples

      <.command_input placeholder="Search..." />
      <.command_input placeholder="Type to search..." icon="tabler-settings" />
  """
  attr :id, :string, default: nil, doc: "The unique identifier for the input"
  attr :icon, :string, default: "tabler-search", doc: "Icon to display on the left side of the input"
  attr :class, :string, default: nil, doc: "Additional CSS classes for the input wrapper"
  attr :rest, :global, doc: "Additional HTML attributes for the input element"

  def command_input(assigns) do
    ~H"""
    <div class={["relative flex items-center gap-2", @class]}>
      <.icon name={@icon} class="size-4 text-zk-surface-foreground/70 absolute left-3" />

      <input
        id={@id}
        type="text"
        class={[
          "bg-zk-surface w-full rounded-t py-2.5 pr-4 pl-10",
          "text-zk-muted-foreground text-sm",
          "border-zk-border border-0 border-b focus-visible:ring-0",
          "placeholder:text-zk-muted-foreground/70",
          "disabled:cursor-not-allowed disabled:opacity-50"
        ]}
        {@rest}
      />
    </div>
    """
  end

  @doc """
  Renders a styled list container for command dialog items.

  This component provides a standardized container for command dialog items with
  proper scrolling behavior and styling.

  ## Examples

      <.command_list>
        <li>
          <button>Menu item 1</button>
        </li>
      </.command_list>

      <.command_list class="max-h-52">
        <li>Settings item</li>
      </.command_list>
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the list"
  slot :inner_block, required: true, doc: "The content of the list"

  def command_list(assigns) do
    ~H"""
    <ul class={["max-h-72 overflow-y-auto overflow-x-hidden", @class]}>
      {render_slot(@inner_block)}
    </ul>
    """
  end
end
