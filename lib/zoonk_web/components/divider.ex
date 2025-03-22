defmodule ZoonkWeb.Components.Divider do
  @moduledoc """
  Provides the UI for rendering dividers.
  """
  use Phoenix.Component

  attr :label, :string, required: true
  attr :class, :string, default: nil

  def divider(assigns) do
    ~H"""
    <div aria-hidden="true" role="presentation" class={["relative my-4", @class]}>
      <div class="absolute inset-0 flex items-center">
        <div class="border-zk-border w-full border-t" />
      </div>

      <div class="relative flex justify-center">
        <span class="bg-zk-background text-zk-secondary-foreground/70 px-2 text-sm">
          {@label}
        </span>
      </div>
    </div>
    """
  end
end
