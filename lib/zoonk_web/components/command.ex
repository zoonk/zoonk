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

  import ZoonkWeb.Components.Button
  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

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
  attr :variant, :atom, values: [:icon, :input], default: :input, doc: "Variant of the command trigger button"
  attr :label, :string, default: gettext("Search..."), doc: "Text to display in the button"
  attr :dialog_id, :string, default: "command-dialog", doc: "ID of the dialog to open"
  attr :class, :string, default: nil, doc: "Additional CSS classes for the button"
  attr :shortcut, :string, default: "k", doc: "Keyboard shortcut key to open the dialog"
  attr :rest, :global, doc: "Additional HTML attributes for the button"

  def command_trigger(%{variant: :input} = assigns) do
    ~H"""
    <button
      id={@id}
      aria-haspopup="dialog"
      aria-controls={@dialog_id}
      phx-hook="DialogTrigger"
      data-dialog-id={@dialog_id}
      data-shortcut={@shortcut}
      class={[
        "bg-zk-background text-zk-foreground/70 transition-all",
        "flex w-full flex-col items-center justify-center gap-2",
        "border-zk-border rounded-md border py-1.5 text-sm",
        "hover:bg-zk-muted focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-zk-primary focus-visible:ring-offset-2",
        "md:flex-row md:justify-between md:rounded-full md:pr-1.5 md:pl-2",
        @class
      ]}
      {@rest}
    >
      <span class="inline-flex items-center gap-2">
        <.icon name="tabler-search" size={:xs} />
        <span class="hidden md:block">{@label}</span>
      </span>

      <kbd
        aria-label={gettext("Shortcut:")}
        class="bg-zk-background border-zk-border text-2xs pointer-events-none hidden gap-1 rounded-full border px-1.5 py-0.5 uppercase md:flex"
      >
        <kbd>⌘</kbd>
        <kbd>{@shortcut}</kbd>
      </kbd>
    </button>
    """
  end

  def command_trigger(%{variant: :icon} = assigns) do
    ~H"""
    <.button
      id={@id}
      size={:sm}
      kind={:icon}
      aria-haspopup="dialog"
      aria-controls={@dialog_id}
      phx-hook="DialogTrigger"
      data-dialog-id={@dialog_id}
      data-shortcut={@shortcut}
      class={@class}
      icon="tabler-search"
      variant={:outline}
      {@rest}
    >
      {@label}
    </.button>
    """
  end

  @doc """
  Renders a styled input field for command dialogs with an icon.

  This component provides a standardized input field used in command dialogs,
  featuring a search icon and consistent styling.

  ## Examples

      <.command_input label="Search..." />
      <.command_input label="Type to search..." icon="tabler-settings" />
  """
  attr :id, :string, default: "command-input", doc: "The unique identifier for the input"
  attr :label, :string, default: gettext("Search..."), doc: "Accessible label for the input"
  attr :icon, :string, default: "tabler-search", doc: "Icon to display on the left side of the input"
  attr :class, :string, default: nil, doc: "Additional CSS classes for the input wrapper"
  attr :rest, :global, doc: "Additional HTML attributes for the input element"

  def command_input(assigns) do
    ~H"""
    <div class={["relative flex items-center gap-2", @class]}>
      <.icon name={@icon} class="size-4 text-zk-foreground/70 absolute left-3" />

      <label for={@id} class="sr-only">{@label}</label>

      <input
        id={@id}
        phx-hook="CommandSearch"
        type="text"
        name="query"
        class={[
          "bg-zk-background w-full rounded-t py-2.5 pr-4 pl-10",
          "text-zk-muted-foreground text-base sm:text-sm",
          "border-zk-border border-0 border-b focus-visible:ring-0",
          "placeholder:text-zk-muted-foreground/70",
          "disabled:cursor-not-allowed disabled:opacity-50"
        ]}
        phx-debounce
        data-command-input
        placeholder={@label}
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
  attr :id, :string, default: "command_list", doc: "The unique identifier for the list"
  attr :class, :string, default: nil, doc: "Additional CSS classes for the list"
  slot :inner_block, required: true, doc: "The content of the list"

  def command_list(assigns) do
    ~H"""
    <div
      data-command-list
      class={[
        "group/list max-h-72 select-none overflow-y-auto overflow-x-hidden md:max-h-100 lg:max-h-124",
        @class
      ]}
      id={@id}
    >
      {render_slot(@inner_block)}
    </div>
    """
  end

  @doc """
  Renders a command item with optional icon and shortcut.

  This component provides a standardized command item that can display
  an icon or image on the left, content in the middle, and an optional
  shortcut indicator on the right.

  ## Examples

      <.command_item>
        <.icon name="tabler-settings" />
        <span>Settings</span>
        <.command_shortcut>⌘S</.command_shortcut>
      </.command_item>

      <.command_item disabled>
        <.icon name="tabler-lock" />
        <span>Restricted Option</span>
      </.command_item>
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the item"
  attr :label, :string, default: nil, doc: "The label for the item"
  attr :selected, :boolean, default: false, doc: "Whether the item is currently selected"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "Additional HTML attributes"
  slot :inner_block, required: true, doc: "The content of the command item"

  def command_item(assigns) do
    ~H"""
    <li role="option" data-command-item data-label={@label} class="group/item">
      <.link
        tabindex="0"
        class={[
          "relative flex w-full select-none items-center gap-2 rounded-sm px-2 py-1.5",
          "text-zk-secondary-foreground/70 text-sm outline-none",
          "hover:bg-zk-secondary",
          "focus-visible:bg-zk-secondary",
          "group-data-[active]/item:bg-zk-secondary",
          @selected && "bg-zk-secondary",
          @class
        ]}
        {@rest}
      >
        {render_slot(@inner_block)}
      </.link>
    </li>
    """
  end

  @doc """
  Renders a keyboard shortcut label for command items.

  This component provides a styled span for displaying keyboard shortcuts
  in command items.

  ## Examples

      <.command_shortcut>⌘K</.command_shortcut>
      <.command_shortcut class="opacity-75">⌘P</.command_shortcut>
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the shortcut"
  attr :rest, :global, doc: "Additional HTML attributes"
  slot :inner_block, required: true, doc: "The content of the shortcut"

  def command_shortcut(assigns) do
    ~H"""
    <span class={["text-zk-muted-foreground ml-auto text-xs tracking-widest", @class]} {@rest}>
      {render_slot(@inner_block)}
    </span>
    """
  end

  @doc """
  Renders a group of command items with an optional heading.

  This component provides a way to group related command items together
  with an optional heading.

  ## Examples

      <.command_group heading="Settings">
        <.command_item>Profile</command_item>
        <.command_item>Billing</command_item>
      </.command_group>

      <.command_group>
        <.command_item>Profile</command_item>
      </.command_group>
  """
  attr :id, :string, required: true, doc: "The unique identifier for the group"
  attr :heading, :string, default: nil, doc: "Optional heading text for the group"
  attr :class, :string, default: nil, doc: "Additional CSS classes for the group"
  attr :kind, :atom, values: [:static, :dynamic], default: :static, doc: "Kind of the group, static or dynamic"
  slot :inner_block, required: true, doc: "The content of the group"

  def command_group(assigns) do
    ~H"""
    <div
      id={@id}
      class={[
        "group/cg select-none overflow-hidden p-1",
        "text-zk-foreground",
        "border-zk-border border-b last:border-b-0",
        "hidden has-[li:not(.hidden)]:block",
        @class
      ]}
    >
      <h6
        :if={@heading}
        class="text-zk-muted-foreground px-2 py-1.5 text-xs font-medium"
      >
        {@heading}
      </h6>

      <ul id={"#{@id}_list"} phx-update={@kind == :static && "ignore"} phx-hook="CommandGroupList">
        {render_slot(@inner_block)}
      </ul>
    </div>
    """
  end

  @doc """
  Renders a message when no results are found in a command dialog.

  This component provides a centered message to display when a search
  returns no results.

  ## Examples

      <.command_empty>No results found.</.command_empty>
      <.command_empty class="py-8">No items match your search.</.command_empty>
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the empty state"
  attr :rest, :global, doc: "Additional HTML attributes"
  slot :inner_block, required: true, doc: "The content to display when no results are found"

  def command_empty(assigns) do
    ~H"""
    <.text
      variant={:secondary}
      tag="p"
      size={:sm}
      class={["block py-6 text-center", "group-has-[li:not(.hidden)]/list:hidden", @class]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.text>
    """
  end
end
