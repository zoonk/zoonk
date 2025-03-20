defmodule ZoonkWeb.Components.Admin do
  @moduledoc false
  use ZoonkWeb, :html

  def stats_card(assigns) do
    ~H"""
    <.card>
      <.text element={:h3} size={:caption} variant={:secondary}>{@title}</.text>
      <.text element={:span} size={:title} variant={:primary}>{@data}</.text>
    </.card>
    """
  end
end
