defmodule ZoonkWeb.Components.Loader do
  @moduledoc """
  Loader components.

  Minimalist pulsing dot loader component for subtle loading states.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Text

  @doc """
  Renders a pulsing dot loader.

  ## Examples

      <.loader />
      <.loader size={:md} />
      <.loader variant={:sky} />
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the loader"
  attr :size, :atom, values: [:xs, :sm, :md, :lg, :xl], default: :sm, doc: "Size of the loader"
  attr :rest, :global, doc: "Additional HTML attributes"

  def loader(assigns) do
    ~H"""
    <div
      role="status"
      aria-label={gettext("Loading")}
      class={["bg-zk-primary animate-zk-pulse rounded-full", size_class(@size), @class]}
      {@rest}
    />
    """
  end

  @doc """
  Renders a full-page loader with customizable title and description.

  This component combines the loader with contextual text to inform users
  about the loading process. Use it for processes that require a full-page
  loading indicator with explanatory text.

  ## Examples

      <.full_page_loader
        title="Loading your data"
        subtitle="Please wait while we prepare your information."
      />

  """
  attr :id, :string, default: "loader_#{System.unique_integer()}", doc: "ID of the loader container"
  attr :class, :any, default: nil, doc: "Additional CSS classes for the container"
  attr :title, :string, required: true, doc: "Main message displayed below the loader"
  attr :subtitle, :string, default: nil, doc: "Secondary text explaining the loading process"
  attr :feature, :string, default: nil, doc: "Text highlighted in primary color (optional)"

  attr :delay_loading, :boolean,
    default: false,
    doc: "Delay loading loader to avoid flicker on fast operations"

  attr :rest, :global, doc: "Additional HTML attributes"

  def full_page_loader(assigns) do
    ~H"""
    <div
      id={@id}
      phx-hook={@delay_loading && "DelayLoading"}
      class={[
        "flex w-full max-w-md flex-col items-center justify-center p-8 text-center",
        @delay_loading && "opacity-0",
        @class
      ]}
      {@rest}
    >
      <div class="mb-8">
        <.loader size={:xl} />
      </div>

      <.text tag="h2" size={:xl} class="mb-4">
        {@title}
        <em :if={@feature} class="text-zk-primary">{@feature}</em>
      </.text>

      <.text variant={:secondary}>
        {@subtitle}
      </.text>
    </div>
    """
  end

  defp size_class(:xs), do: "size-1.5"
  defp size_class(:sm), do: "size-2.5"
  defp size_class(:md), do: "size-4"
  defp size_class(:lg), do: "size-6"
  defp size_class(:xl), do: "size-8"
end
