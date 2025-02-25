defmodule ZoonkWeb.Components.Divider do
  @moduledoc """
  Provides the UI for rendering dividers.
  """
  use Phoenix.Component

  attr :label, :string, required: true
  attr :class, :string, default: nil

  def divider(assigns) do
    ~H"""
    <div class={["relative", @class]}>
      <div class="absolute inset-0 flex items-center" aria-hidden="true">
        <div class="border-zk-border w-full border-t"></div>
      </div>

      <div class="relative flex justify-center">
        <span class="bg-zk-bg-light text-zk-text-secondary px-2 text-sm dark:bg-zk-bg-dark">
          {@label}
        </span>
      </div>
    </div>
    """
  end
end
