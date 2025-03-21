defmodule ZoonkWeb.Live.UserLogin do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  alias Zoonk.Configuration

  def render(assigns) do
    ~H"""
    <.main_container action={:login}>
      <section aria-label={dgettext("users", "Use one of the external providers below:")}>
        <.auth_link :for={provider <- Configuration.list_providers()} provider={provider} />
      </section>

      <section aria-label={dgettext("users", "Or use your email address")}>
        <.divider label={dgettext("users", "or")} />
        <.auth_link provider={:email} />
      </section>
    </.main_container>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: dgettext("users", "Sign in"))}
  end
end
