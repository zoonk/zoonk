defmodule ZoonkWeb.Live.UserSignIn do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  def render(assigns) do
    ~H"""
    <.main_container action={:signin}>
      <section
        class="flex w-full flex-col gap-2"
        aria-label={dgettext("users", "Use one of the external providers below:")}
      >
        <.auth_link :for={provider <- [:apple, :google, :github]} provider={provider} />
      </section>

      <section class="w-full" aria-label={dgettext("users", "Or use your email address")}>
        <.divider label={dgettext("users", "or")} class="my-4" />
        <.auth_link provider={:email} />
      </section>
    </.main_container>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: dgettext("users", "Sign in"))}
  end
end
