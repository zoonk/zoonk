defmodule ZoonkWeb.Components.AsyncPage do
  @moduledoc """
  Wrapper for `async_result`.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Anchor
  import ZoonkWeb.Components.Loader
  import ZoonkWeb.Components.Text

  @doc """
  Wrapper for `async_result`.

  This component is designed for cases where we use `assign_async`
  and we want to display loading, error, or success states.
  """
  attr :class, :any, default: nil, doc: "Additional CSS classes for the component"
  attr :data, :any, required: true, doc: "The data to be displayed"
  attr :loading_title, :string, required: true, doc: "Title to display while loading"
  attr :loading_subtitle, :string, doc: "Subtitle to display while loading"
  attr :loading_feature, :string, doc: "Feature to display while loading"
  attr :failure_message, :string, doc: "Message to display on failure"
  attr :failure_link, :string, doc: "Link to display on failure"
  attr :failure_link_text, :string, doc: "Text for the failure link"
  slot :inner_block, doc: "Content to display when data is available"

  def async_page(assigns) do
    ~H"""
    <.async_result :let={data} assign={@data}>
      <:loading>
        <section class="zk-full">
          <.full_page_loader
            title={@loading_title}
            feature={@loading_feature}
            delay_loading
            subtitle={@loading_subtitle}
          />
        </section>
      </:loading>

      <:failed :let={_failure}>
        <section class="zk-full">
          <.text variant={:destructive}>
            {@failure_message}
          </.text>

          <.a kind={:button} navigate={@failure_link} size={:sm} class="mt-4">
            {@failure_link_text}
          </.a>
        </section>
      </:failed>

      <article class={@class}>
        {render_slot(@inner_block, data)}
      </article>
    </.async_result>
    """
  end
end
