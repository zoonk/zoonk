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
  attr :flash, :map, default: %{}, doc: "the map of flash messages to display"
  attr :title, :string, default: nil
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
      phx-hook="ClearFlash"
      data-kind={@kind}
      role="alert"
      aria-label={@title}
      tabindex="0"
      class={[
        "fixed top-4 right-4 z-50 rounded-lg px-4 py-2",
        "max-w-80 sm:max-w-96",
        "transition-all duration-300 ease-in-out",
        @kind == :info &&
          [
            "bg-zk-surface text-zk-text-secondary",
            "ring-zk-border shadow-sm ring-1",
            "contrast-more:text-zk-text-contrast",
            "dark:bg-zk-surface-inverse dark:ring-zk-border-inverse",
            "dark:text-zk-text-inverse",
            "dark:contrast-more:ring-zk-border"
          ],
        @kind == :error && ["bg-zk-danger-700 text-zk-danger-50 contrast-more:bg-zk-danger-900"]
      ]}
      {@rest}
    >
      <span class="text-sm">{msg}</span>
    </div>
    """
  end

  @doc """
  Shows the flash group with standard titles and content.

  ## Examples

      <.flash_group flash={@flash} />
  """
  attr :flash, :map, required: true, doc: "the map of flash messages"
  attr :id, :string, default: "flash-group", doc: "the optional id of flash container"

  def flash_group(assigns) do
    ~H"""
    <div id={@id}>
      <.flash kind={:info} title={gettext("Success!")} flash={@flash} />
      <.flash kind={:error} title={gettext("Error!")} flash={@flash} />

      <.flash
        id="client-error"
        kind={:error}
        title={gettext("We can't find the internet")}
        phx-disconnected={show(".phx-client-error #client-error")}
        phx-connected={hide("#client-error")}
        hidden
      >
        {gettext("Attempting to reconnect")}
        <.icon name="tabler-refresh" class="ml-1 h-3 w-3 animate-spin" />
      </.flash>

      <.flash
        id="server-error"
        kind={:error}
        title={gettext("Something went wrong!")}
        phx-disconnected={show(".phx-server-error #server-error")}
        phx-connected={hide("#server-error")}
        hidden
      >
        {gettext("Hang in there while we get back on track")}
        <.icon name="tabler-refresh" class="ml-1 h-3 w-3 animate-spin" />
      </.flash>
    </div>
    """
  end
end
