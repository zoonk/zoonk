defmodule ZoonkWeb.Components.Accordion do
  @moduledoc """
  Accordion components using native HTML details/summary elements.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  @doc """
  Renders an accordion item using native HTML details/summary elements.

  ## Examples

      <.accordion title="What is Zoonk?">
        Zoonk is an educational platform for learning.
      </.accordion>

      <.accordion title="Getting Started" open>
        Follow our installation guide to get started.
      </.accordion>

      <.accordion title="Advanced Features" class="mb-4">
        Explore advanced features like custom themes and integrations.
      </.accordion>
  """
  attr :title, :string, required: true, doc: "The title/summary text for the accordion"
  attr :open, :boolean, default: false, doc: "Whether the accordion is open by default"
  attr :class, :any, default: nil, doc: "CSS class to apply to the details element"
  attr :rest, :global, doc: "HTML attributes to apply to the details element"
  slot :inner_block, required: true, doc: "Content to render inside the accordion"

  def accordion(assigns) do
    ~H"""
    <details class={["border-zk-border border-b py-4 last:border-b-0", @class]} open={@open} {@rest}>
      <summary class="text-zk-foreground flex cursor-pointer select-none items-center justify-between text-sm font-medium hover:underline :[&:-webkit-details-marker]:hidden :[&:marker]:content-['']">
        {@title}

        <.icon
          name="tabler-chevron-down"
          class="size-4 text-zk-muted-foreground [details[open]_&]:rotate-180 shrink-0 transition-transform duration-200"
        />
      </summary>

      <div class="text-zk-muted-foreground pt-4 text-sm">
        {render_slot(@inner_block)}
      </div>
    </details>
    """
  end
end
