defmodule ZoonkWeb.AuthLoginLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.AuthComponents

  alias Zoonk.Config.AuthConfig

  def render(assigns) do
    ~H"""
    <.main_container action={:login} flash={@flash}>
      <section
        aria-label={dgettext("auth", "Use one of the external providers below:")}
        class="flex w-full flex-col gap-2"
      >
        <.auth_link :for={provider <- AuthConfig.list_providers()} provider={provider} />
      </section>

      <section aria-label={dgettext("auth", "Or use your email address")} class="w-full">
        <.divider label={dgettext("auth", "or")} background={:bg} />
        <.auth_link provider={:email} />
      </section>
    </.main_container>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: dgettext("page_title", "Sign in"))}
  end
end
