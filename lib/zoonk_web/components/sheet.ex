defmodule ZoonkWeb.Components.Sheet do
  @moduledoc """
  Sheet components for overlay panels that slide in from screen edges.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  alias Phoenix.LiveView.JS

  @doc """
  Renders a sheet component that slides in from the specified position.

  ## Examples

      <.sheet id="my-sheet" position={:bottom}>
        <.sheet_header>
          <.sheet_title>Sheet Title</.sheet_title>
        </.sheet_header>
        <.sheet_content>
          Content goes here
        </.sheet_content>
      </.sheet>

      <.sheet id="side-sheet" position={:right}>
        <.sheet_content>
          Side panel content
        </.sheet_content>
      </.sheet>
  """
  attr :id, :string, required: true, doc: "The unique identifier for the sheet"

  attr :position, :atom,
    values: [:top, :bottom, :left, :right],
    default: :bottom,
    doc: "Position from which the sheet slides in"

  attr :class, :any, default: nil, doc: "Additional CSS classes for the sheet"

  slot :inner_block, required: true, doc: "The content of the sheet"

  def sheet(assigns) do
    ~H"""
    <div
      id={@id}
      class="fixed inset-0 z-50 hidden"
      phx-click-away={hide_sheet(@id)}
      phx-window-keydown={hide_sheet(@id)}
      phx-key="Escape"
    >
      <!-- Backdrop -->
      <div class="bg-zk-background/20 fixed inset-0 backdrop-blur-sm" />
      
    <!-- Sheet Content -->
      <div
        class={[
          "bg-zk-surface text-zk-surface-foreground ring-zk-border/60 fixed shadow-lg ring",
          position_classes(@position),
          @class
        ]}
        data-position={@position}
      >
        <div class="flex h-full flex-col">
          {render_slot(@inner_block)}
        </div>
      </div>
    </div>
    """
  end

  @doc """
  Renders a sheet header.

  ## Examples

      <.sheet_header>
        <.sheet_title>Sheet Title</.sheet_title>
        <.sheet_description>Optional description</.sheet_description>
      </.sheet_header>
  """
  attr :class, :any, default: nil, doc: "Additional CSS classes for the sheet header"
  slot :inner_block, required: true, doc: "The header content"

  def sheet_header(assigns) do
    ~H"""
    <header class={[
      "bg-zk-secondary/70 border-zk-border flex shrink-0 items-center justify-between gap-4 rounded-t border-b p-6",
      @class
    ]}>
      <div class="flex flex-col gap-1.5">
        {render_slot(@inner_block)}
      </div>
      <button
        phx-click={hide_sheet_by_close()}
        class="text-zk-muted-foreground rounded-sm opacity-70 transition-opacity hover:text-zk-surface-foreground hover:opacity-100 focus:ring-zk-ring focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        <.icon name="tabler-x" class="size-4" />
        <span class="sr-only">Close</span>
      </button>
    </header>
    """
  end

  @doc """
  Renders a sheet title.

  ## Examples

      <.sheet_title>Sheet Title</.sheet_title>
  """
  attr :class, :any, default: nil, doc: "Additional CSS classes for the sheet title"
  slot :inner_block, required: true, doc: "The title content"

  def sheet_title(assigns) do
    ~H"""
    <h2 class={[
      "text-zk-surface-foreground text-lg font-semibold leading-none tracking-tight",
      @class
    ]}>
      {render_slot(@inner_block)}
    </h2>
    """
  end

  @doc """
  Renders a sheet description.

  ## Examples

      <.sheet_description>Optional description text</.sheet_description>
  """
  attr :class, :any, default: nil, doc: "Additional CSS classes for the sheet description"
  slot :inner_block, required: true, doc: "The description content"

  def sheet_description(assigns) do
    ~H"""
    <p class={["text-zk-muted-foreground text-sm", @class]}>
      {render_slot(@inner_block)}
    </p>
    """
  end

  @doc """
  Renders a sheet content area.

  ## Examples

      <.sheet_content>
        <p>Sheet content goes here</p>
      </.sheet_content>
  """
  attr :class, :any, default: nil, doc: "Additional CSS classes for the sheet content"
  slot :inner_block, required: true, doc: "The content"

  def sheet_content(assigns) do
    ~H"""
    <div class={["flex-1 overflow-auto p-6", @class]}>
      {render_slot(@inner_block)}
    </div>
    """
  end

  @doc """
  Renders a sheet footer.

  ## Examples

      <.sheet_footer>
        <.button>Save</.button>
        <.button variant={:outline}>Cancel</.button>
      </.sheet_footer>
  """
  attr :class, :any, default: nil, doc: "Additional CSS classes for the sheet footer"
  slot :inner_block, required: true, doc: "The footer content"

  def sheet_footer(assigns) do
    ~H"""
    <footer class={[
      "border-zk-border flex shrink-0 flex-col-reverse gap-2 border-t p-6 sm:flex-row sm:justify-end sm:space-x-2",
      @class
    ]}>
      {render_slot(@inner_block)}
    </footer>
    """
  end

  # Helper function to determine positioning classes based on sheet position
  defp position_classes(:top) do
    "top-0 left-0 right-0 max-h-[85vh] rounded-b"
  end

  defp position_classes(:bottom) do
    "bottom-0 left-0 right-0 max-h-[85vh] rounded-t"
  end

  defp position_classes(:left) do
    "top-0 bottom-0 left-0 w-[90vw] max-w-md rounded-r"
  end

  defp position_classes(:right) do
    "top-0 bottom-0 right-0 w-[90vw] max-w-md rounded-l"
  end

  # JavaScript commands for hiding sheets
  defp hide_sheet(js \\ %JS{}, id) do
    JS.hide(js, to: "##{id}", time: 200, transition: {"transition-all ease-in duration-200", "opacity-100", "opacity-0"})
  end

  defp hide_sheet_by_close(js \\ %JS{}) do
    JS.dispatch(js, "click", to: "[phx-click-away]")
  end
end
