defmodule ZoonkWeb.Components.Flash do
  @moduledoc """
  Provides the UI for rendering flash messages.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Utils

  alias Phoenix.LiveView.JS

  @doc """
  Renders flash notices.

  ## Examples

      <.flash kind={:info} flash={@flash} />
      <.flash kind={:info} phx-mounted={show("#flash")}>Welcome Back!</.flash>
  """
  attr :id, :string, doc: "the optional id of flash container"

  attr :position, :atom,
    values: [:top_left, :top_right, :bottom_left, :bottom_right, :none],
    default: :top_right,
    doc: "the position of the flash message on the screen"

  attr :flash, :map, default: %{}, doc: "the map of flash messages to display"
  attr :kind, :atom, values: [:info, :error], doc: "used for styling and flash lookup"
  attr :rest, :global, doc: "the arbitrary HTML attributes to add to the flash container"

  slot :inner_block, doc: "the optional inner block that renders the flash message"

  def flash(assigns) do
    assigns = assign_new(assigns, :id, fn -> "flash-#{assigns.kind}" end)

    ~H"""
    <div
      :if={msg = render_slot(@inner_block) || Phoenix.Flash.get(@flash, @kind)}
      id={@id}
      phx-click={JS.push("lv:clear-flash", value: %{key: @kind}) |> hide("##{@id}")}
      role="alert"
      tabindex="0"
      class={[
        "z-50 flex items-center justify-between rounded border px-4 py-2 text-sm",
        "max-w-80 sm:max-w-96",
        "transition-all duration-300 ease-in-out",
        @kind == :info && "bg-zk-surface text-zk-secondary-foreground border-zk-border",
        @kind == :error &&
          "bg-zk-destructive-subtle text-zk-destructive-subtle-foreground border-zk-destructive-subtle-foreground",
        position_class(@position)
      ]}
      {@rest}
    >
      {msg}

      <button type="button" class="group cursor-pointer self-start" aria-label={gettext("close")}>
        <.icon name="tabler-x" class="opacity-40 group-hover:opacity-70" />
      </button>
    </div>
    """
  end

  @doc """
  Shows the flash group with standard content.

  ## Examples

      <.flash_group flash={@flash} />
  """
  attr :flash, :map, required: true, doc: "the map of flash messages"
  attr :id, :string, default: "flash-group", doc: "the optional id of flash container"

  def flash_group(assigns) do
    ~H"""
    <div id={@id}>
      <.flash kind={:info} flash={@flash} />
      <.flash kind={:error} flash={@flash} />

      <.flash
        id="client-error"
        kind={:error}
        phx-disconnected={show(".phx-client-error #client-error")}
        phx-connected={hide("#client-error")}
        hidden
      >
        {gettext("Connection lost. Attempting to reconnect")}
        <.icon name="tabler-refresh" class="ml-1 h-3 w-3 animate-spin" />
      </.flash>

      <.flash
        id="server-error"
        kind={:error}
        phx-disconnected={show(".phx-server-error #server-error")}
        phx-connected={hide("#server-error")}
        hidden
      >
        {gettext("There was an error on the server")}
        <.icon name="tabler-refresh" class="ml-1 h-3 w-3 animate-spin" />
      </.flash>
    </div>
    """
  end

  defp position_class(:top_left), do: "fixed top-4 left-4"
  defp position_class(:top_right), do: "fixed top-4 right-4"
  defp position_class(:bottom_left), do: "fixed bottom-4 left-4"
  defp position_class(:bottom_right), do: "fixed bottom-4 right-4"
  defp position_class(:none), do: nil
end
