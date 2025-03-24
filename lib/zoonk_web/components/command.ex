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
end
