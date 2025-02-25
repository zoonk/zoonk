defmodule ZoonkWeb.Components.Divider do
  @moduledoc """
  Provides the UI for rendering dividers.
  """
  use Phoenix.Component

  attr :label, :string, required: true
  attr :class, :string, default: nil

  def divider(assigns) do
    ~H"""
    <div class={["relative", @class]} aria-hidden="true" role="presentation">
      <div class="absolute inset-0 flex items-center">
        <div class={[
          "w-full border-t",
          "border-zk-border",
          "dark:border-zk-border-inverse",
          "contrast-more:border-zk-border-focus",
          "dark:contrast-more:border-zk-border"
        ]} />
      </div>

      <div class="relative flex justify-center">
        <span class={[
          "bg-zk-bg-light px-2",
          "text-zk-text-secondary text-sm",
          "dark:bg-zk-bg-dark dark:text-zk-text-inverse-secondary",
          "contrast-more:text-zk-text-primary",
          "dark:contrast-more:text-zk-text-inverse"
        ]}>
          {@label}
        </span>
      </div>
    </div>
    """
  end
end
