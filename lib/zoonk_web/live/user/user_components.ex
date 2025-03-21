defmodule ZoonkWeb.Components.User do
  @moduledoc """
  Shared components for user authentication and settings.
  """
  use ZoonkWeb, :html

  alias Zoonk.Configuration

  @actions [:login, :signup]

  @doc """
  Generates a link to the authentication provider.
  """
  attr :provider, :atom, values: [:email | Configuration.list_providers()], required: true
  attr :action, :atom, values: @actions, default: :login

  def auth_link(assigns) do
    ~H"""
    <.a
      kind={:button}
      icon={get_icon(@provider)}
      variant={:outline}
      full
      {get_navigate_attr(@action, @provider)}
    >
      {get_auth_label(@action, @provider)}
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
    <section aria-label={get_footer_aria_title(@action)}>
      <.text aria-hidden="true" size={:caption} variant={:secondary}>
        {get_footer_title(@action)}
      </.text>

      <.a navigate={get_auth_link(@action)}>{get_footer_cta(@action)}</.a>
    </section>
    """
  end

  @doc """
  Displays the authentication page title.
  """
  attr :action, :atom, values: @actions, default: :login

  def auth_title(assigns) do
    ~H"""
    <.text id="auth-title" tag="h1" size={:header}>
      {get_auth_header(@action)}
    </.text>
    """
  end

  @doc """
  Wraps the authentication page into a container.
  """
  attr :action, :atom, values: @actions, default: :login
  attr :show_options, :boolean, default: false
  slot :inner_block, required: true

  def main_container(assigns) do
    ~H"""
    <main aria-labelledby="auth-title">
      <.auth_title action={@action} />

      {render_slot(@inner_block)}

      <.a :if={@show_options} weight={:normal} navigate={get_auth_link(get_footer_action(@action))}>
        ← {get_back_label(@action)}
      </.a>

      <section
        :if={@action == :signup}
        aria-label={dgettext("users", "Terms of user and privacy policy")}
      >
        <.text size={:caption} variant={:secondary}>
          {dgettext("users", "By signing up, you agree to our %{terms} and %{privacy}.",
            terms: get_terms_link("/terms", dgettext("users", "Terms of Use")),
            privacy: get_terms_link("/privacy", dgettext("users", "Privacy Policy"))
          )
          |> Phoenix.HTML.raw()}
        </.text>
      </section>

      <.footer_link action={get_footer_action(@action)} />
    </main>
    """
  end

  defp get_auth_header(:login), do: dgettext("users", "Access your Zoonk account.")
  defp get_auth_header(:signup), do: dgettext("users", "Start learning the skills to build amazing things.")

  defp get_auth_link(:login), do: ~p"/login"
  defp get_auth_link(:signup), do: ~p"/signup"

  defp get_auth_link(:login, :email), do: ~p"/login/email"
  defp get_auth_link(:signup, :email), do: ~p"/signup/email"
  defp get_auth_link(_action, provider), do: ~p"/auth/#{provider}"

  defp get_auth_label(:login, :email), do: dgettext("users", "Login with Email")
  defp get_auth_label(:signup, :email), do: dgettext("users", "Sign up with Email")

  defp get_auth_label(_action, provider),
    do: dgettext("users", "Continue with %{provider}", provider: provider_name(provider))

  defp get_back_label(:login), do: dgettext("users", "Other login options")
  defp get_back_label(:signup), do: dgettext("users", "Other sign up options")

  defp provider_name(provider) do
    provider
    |> Atom.to_string()
    |> String.capitalize()
  end

  defp get_icon(:apple), do: "tabler-brand-apple-filled"
  defp get_icon(:github), do: "tabler-brand-github-filled"
  defp get_icon(:google), do: "tabler-brand-google-filled"
  defp get_icon(:email), do: "tabler-mail-filled"

  # We show the opposite action in the footer
  # If a user is in the login page, we show the signup link
  # If a user is in the signup page, we show the login link
  # So, we need to get the opposite action
  defp get_footer_action(:login), do: :signup
  defp get_footer_action(:signup), do: :login

  defp get_footer_aria_title(:login), do: dgettext("users", "Login to your account")
  defp get_footer_aria_title(:signup), do: dgettext("users", "Create an account")

  defp get_footer_title(:login), do: dgettext("users", "Already have an account?")
  defp get_footer_title(:signup), do: dgettext("users", "Don't have an account?")

  defp get_footer_cta(:login), do: dgettext("users", "Login")
  defp get_footer_cta(:signup), do: dgettext("users", "Sign up")

  defp get_terms_link(link, label) do
    "<a href='#{link}' class=\"underline\">#{label}</a>"
  end

  defp get_navigate_attr(action, :email), do: [navigate: get_auth_link(action, :email)]
  defp get_navigate_attr(action, provider), do: [href: get_auth_link(action, provider)]
end
