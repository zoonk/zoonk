defmodule ZoonkWeb.AuthComponents do
  @moduledoc false
  use ZoonkWeb, :html

  @actions [:login, :signup, :confirm]
  @oauth_providers Application.compile_env(:zoonk, :oauth_providers, [])

  @doc """
  Generates a link to the authentication provider.
  """
  attr :provider, :atom, values: [:email | @oauth_providers], required: true
  attr :action, :atom, values: @actions, default: :login

  def auth_link(assigns) do
    ~H"""
    <.a
      kind={:button}
      icon={auth_icon(@provider)}
      variant={:outline}
      size={:md}
      class="w-full"
      icon_align={:left}
      {navigate_attr(@action, @provider)}
    >
      {auth_label(@action, @provider)}
    </.a>
    """
  end

  @doc """
  Displays the footer link.

  When on the login page, it shows the signup link and vice versa.
  """
  attr :action, :atom, values: @actions, default: :signup

  def footer_link(assigns) do
    ~H"""
    <section
      aria-label={footer_aria_title(@action)}
      class={[
        "bg-zk-background fixed bottom-0 w-full p-4 text-center sm:p-8",
        "border-zk-border border-t"
      ]}
    >
      <.text aria-hidden="true" size={:sm} variant={:secondary} class="leading-3">
        {footer_title(@action)}
      </.text>

      <.a navigate={auth_link_href(@action)} class="text-sm font-semibold">
        {footer_cta(@action)}
      </.a>
    </section>
    """
  end

  @doc """
  Displays the authentication page title.
  """
  attr :action, :atom, values: @actions, default: :login

  def auth_title(assigns) do
    ~H"""
    <.text id="auth-title" tag="h1" size={:xxl} class="w-full pb-8">
      {auth_header(@action)}
    </.text>
    """
  end

  @doc """
  Wraps the authentication page into a container.
  """
  attr :action, :atom, values: @actions, default: :login
  attr :show_options, :boolean, default: false
  attr :flash, :map, default: %{}
  slot :inner_block, required: true

  def main_container(assigns) do
    ~H"""
    <main
      aria-labelledby="auth-title"
      class="h-[calc(100dvh-70px)] mx-auto flex max-w-sm flex-col items-center justify-center px-8 text-center"
    >
      <.flash_group flash={@flash} />
      <.auth_title action={@action} />

      {render_slot(@inner_block)}

      <.a :if={@show_options} navigate={auth_link_href(@action)} class="mt-4 text-sm">
        ← {back_label(@action)}
      </.a>

      <section
        :if={@action == :signup}
        aria-label={dgettext("auth", "Terms of user and privacy policy")}
        class="pt-8"
      >
        <.text size={:sm} variant={:secondary}>
          {dgettext("auth", "By signing up, you agree to our %{terms} and %{privacy}.",
            terms: terms_link("/terms", dgettext("auth", "Terms of Use")),
            privacy: terms_link("/privacy", dgettext("auth", "Privacy Policy"))
          )
          |> Phoenix.HTML.raw()}
        </.text>
      </section>

      <.footer_link :if={@action != :confirm} action={footer_action(@action)} />
    </main>
    """
  end

  defp auth_header(:login), do: dgettext("auth", "Access your Zoonk account")
  defp auth_header(:signup), do: dgettext("auth", "Start learning the skills to build amazing things")
  defp auth_header(:confirm), do: dgettext("auth", "Validate your email address")

  defp auth_link_href(:login), do: ~p"/login"
  defp auth_link_href(:signup), do: ~p"/signup"

  defp auth_link_href(:login, :email), do: ~p"/login/email"
  defp auth_link_href(:signup, :email), do: ~p"/signup/email"
  defp auth_link_href(_action, provider), do: ~p"/auth/#{provider}"

  defp auth_label(:login, :email), do: dgettext("auth", "Login with Email")
  defp auth_label(:signup, :email), do: dgettext("auth", "Sign up with Email")

  defp auth_label(_action, provider), do: dgettext("auth", "Continue with %{provider}", provider: provider_name(provider))

  defp back_label(:login), do: dgettext("auth", "Other login options")
  defp back_label(:signup), do: dgettext("auth", "Other sign up options")

  defp provider_name(provider) do
    provider
    |> Atom.to_string()
    |> String.capitalize()
  end

  defp auth_icon(:apple), do: "tabler-brand-apple-filled"
  defp auth_icon(:github), do: "tabler-brand-github-filled"
  defp auth_icon(:google), do: "tabler-brand-google-filled"
  defp auth_icon(:email), do: "tabler-mail-filled"

  # We show the opposite action in the footer
  # If a user is in the login page, we show the signup link
  # If a user is in the signup page, we show the login link
  # So, we need to get the opposite action
  defp footer_action(:login), do: :signup
  defp footer_action(:signup), do: :login

  defp footer_aria_title(:login), do: dgettext("auth", "Login to your account")
  defp footer_aria_title(:signup), do: dgettext("auth", "Create an account")

  defp footer_title(:login), do: dgettext("auth", "Already have an account?")
  defp footer_title(:signup), do: dgettext("auth", "Don't have an account?")

  defp footer_cta(:login), do: dgettext("auth", "Login")
  defp footer_cta(:signup), do: dgettext("auth", "Sign up")

  defp terms_link(link, label) do
    "<a href='#{link}' class=\"underline\">#{label}</a>"
  end

  defp navigate_attr(action, :email), do: [navigate: auth_link_href(action, :email)]
  defp navigate_attr(action, provider), do: [href: auth_link_href(action, provider)]
end
