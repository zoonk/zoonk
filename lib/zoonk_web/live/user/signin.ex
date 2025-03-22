defmodule ZoonkWeb.Live.UserLogin do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  alias Zoonk.Configuration

  def render(assigns) do
    ~H"""
    <.main_container action={:login}>
      <section
        aria-label={dgettext("users", "Use one of the external providers below:")}
        class="flex w-full flex-col gap-2"
      >
        <.auth_link :for={provider <- Configuration.list_providers()} provider={provider} />
      </section>

      <section aria-label={dgettext("users", "Or use your email address")} class="w-full">
        <.divider label={dgettext("users", "or")} background={:bg} />
        <.auth_link provider={:email} />
      </section>
    </.main_container>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: dgettext("users", "Sign in"))}
  end
end
