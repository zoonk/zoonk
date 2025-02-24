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
        <div class="w-full border-t border-gray-300"></div>
      </div>

      <div class="relative flex justify-center">
        <span class="bg-background-light px-2 text-sm text-gray-500 dark:bg-background-dark">
          {@label}
        </span>
      </div>
    </div>
    """
  end
end
