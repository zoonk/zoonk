defmodule ZoonkWeb.FollowLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  
  alias Zoonk.Accounts

  describe "Follow page" do
    setup :setup_app

    test "displays global social media links for non-Portuguese users", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/follow")

      # Should display global links
      assert html =~ "https://bsky.app/profile/zoonk.bsky.social"
      assert html =~ "https://www.facebook.com/zoonkcom"
      assert html =~ "https://www.instagram.com/zoonkcom"
      assert html =~ "https://www.linkedin.com/company/zoonk"
      assert html =~ "https://www.reddit.com/r/zoonk"
      assert html =~ "https://www.threads.net/@zoonkcom"
      assert html =~ "https://www.tiktok.com/@zoonkcom"
      assert html =~ "https://x.com/zoonkcom"
      assert html =~ "https://www.youtube.com/@zoonkcom"

      # Should include all expected social media icons
      assert html =~ "tabler-brand-bluesky"
      assert html =~ "tabler-brand-facebook"
      assert html =~ "tabler-brand-instagram"
      assert html =~ "tabler-brand-linkedin"
      assert html =~ "tabler-brand-reddit"
      assert html =~ "tabler-brand-threads"
      assert html =~ "tabler-brand-tiktok"
      assert html =~ "tabler-brand-x"
      assert html =~ "tabler-brand-youtube"

      # Should have proper external link attributes
      assert html =~ ~r/target="_blank"/
      assert html =~ ~r/rel="noopener noreferrer"/
    end

    test "displays Brazil social media links for Portuguese users", %{conn: conn} do
      # Setup authenticated user with Portuguese language
      user = Zoonk.AccountFixtures.user_fixture()
      Accounts.update_user_settings(user, %{language: :pt})
      
      {:ok, _view, html} = 
        conn
        |> login_user(user)
        |> live(~p"/follow")

      # Should display Brazil links (except LinkedIn which uses global)
      assert html =~ "https://bsky.app/profile/zoonkbr.bsky.social"
      assert html =~ "https://www.facebook.com/zoonkbr"
      assert html =~ "https://www.instagram.com/zoonkbr"
      assert html =~ "https://www.linkedin.com/company/zoonk"  # LinkedIn uses global link
      assert html =~ "https://www.reddit.com/r/ZoonkBrasil"
      assert html =~ "https://www.threads.net/@zoonkbr"
      assert html =~ "https://www.tiktok.com/@zoonkbr"
      assert html =~ "https://x.com/zoonkbr"
      assert html =~ "https://www.youtube.com/@zoonkbr"

      # Should not display global-specific links (except LinkedIn)
      refute html =~ "https://www.facebook.com/zoonkcom"
      refute html =~ "https://www.reddit.com/r/zoonk"
    end

    test "displays Brazil links when user language is Portuguese", %{conn: conn} do
      # Create a user with Portuguese language and login
      # Since the plug overwrites session language for non-authenticated users,
      # we need to test with an authenticated user
      user = Zoonk.AccountFixtures.user_fixture()
      Accounts.update_user_settings(user, %{language: :pt})
      
      {:ok, _view, html} = 
        conn
        |> login_user(user)
        |> live(~p"/follow")

      # Should display Brazil links for Portuguese user
      assert html =~ "https://www.facebook.com/zoonkbr"
      assert html =~ "@zoonkbr"
      assert html =~ "r/ZoonkBrasil"
    end

    test "renders follow us page title", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/follow")

      assert page_title(view) =~ "Follow us"
    end

    test "displays descriptive text about social media", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/follow")

      assert html =~ "Stay connected with us on social media"
    end

    test "social media links have proper structure", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/follow")

      # Should have grid layout
      assert html =~ ~r/class="[^"]*grid[^"]*"/
      
      # Each link should have icon and handle
      assert html =~ "@zoonk"
      assert html =~ "r/zoonk"
      assert html =~ "@zoonkcom"
    end
  end
end