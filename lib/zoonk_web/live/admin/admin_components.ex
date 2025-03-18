defmodule ZoonkWeb.Components.Admin do
  @moduledoc false
  use ZoonkWeb, :html

  def stats_card(assigns) do
    ~H"""
    <div class="bg-zk-surface rounded-lg p-4 shadow-sm dark:bg-zk-surface-inverse">
      <.text element={:h3} size={:caption} variant={:secondary}>{@title}</.text>
      <.text element={:span} size={:title} variant={:primary}>{@data}</.text>
    </div>
    """
  end
end
