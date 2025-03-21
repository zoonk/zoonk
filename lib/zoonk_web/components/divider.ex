defmodule ZoonkWeb.Components.Divider do
  @moduledoc """
  Provides the UI for rendering dividers.
  """
  use Phoenix.Component

  attr :label, :string, required: true
  attr :class, :string, default: nil

  def divider(assigns) do
    ~H"""
    <div aria-hidden="true" role="presentation">
      <div>
        <div />
      </div>

      <div>
        <span>
          {@label}
        </span>
      </div>
    </div>
    """
  end
end
