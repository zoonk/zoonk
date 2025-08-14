defmodule ZoonkWeb.UserInterestsLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts.UserInterests
  alias Zoonk.Repo

  describe "update interests form" do
    setup :signup_and_login_user

    test "updates interests successfully", %{conn: conn, user: user} do
      conn
      |> visit(~p"/interests")
      |> fill_in("What are you interested in?", with: "programming, music, cooking")
      |> fill_in("Favorite books, movies, TV shows, or games", with: "Star Trek, The Office")
      |> fill_in("What are your hobbies?", with: "gaming, reading")
      |> fill_in("What field do you work in?", with: "software engineering")
      |> fill_in("Where are you from?", with: "New York")
      |> fill_in("What do you find challenging when learning?", with: "math, focus")
      |> fill_in("What types of examples help you learn best?", with: "practical examples")
      |> refute_has("p", text: "Done!")
      |> submit()
      |> assert_path(~p"/interests")
      |> assert_has("p", text: "Done!")

      updated_interests = Repo.get_by!(UserInterests, user_id: user.id)
      assert updated_interests.interests == "programming, music, cooking"
      assert updated_interests.favorite_media == "Star Trek, The Office"
      assert updated_interests.hobbies == "gaming, reading"
      assert updated_interests.work_field == "software engineering"
      assert updated_interests.location == "New York"
      assert updated_interests.learning_struggles == "math, focus"
      assert updated_interests.preferred_examples == "practical examples"
    end

    test "updates existing interests", %{conn: conn, user: user} do
      user_interests_fixture(%{user: user, interests: "old interest", work_field: "old job", location: "old location"})

      conn
      |> visit(~p"/interests")
      |> fill_in("What are you interested in?", with: "new interest, updated interest")
      |> fill_in("What field do you work in?", with: "new job")
      |> fill_in("Where are you from?", with: "new location")
      |> submit()
      |> assert_path(~p"/interests")
      |> assert_has("p", text: "Done!")

      updated_interests = Repo.get_by!(UserInterests, user_id: user.id)
      assert updated_interests.interests == "new interest, updated interest"
      assert updated_interests.work_field == "new job"
      assert updated_interests.location == "new location"
    end

    test "displays current interests in the form", %{conn: conn, user: user} do
      user_interests_fixture(%{
        user: user,
        interests: "programming, music",
        work_field: "engineering",
        location: "San Francisco"
      })

      conn
      |> visit(~p"/interests")
      |> assert_has("textarea", name: "user[interests]", text: "programming, music")
      |> assert_has("input", name: "user[work_field]", value: "engineering")
      |> assert_has("input", name: "user[location]", value: "San Francisco")
    end

    test "displays empty fields when user has no interests", %{conn: conn} do
      conn
      |> visit(~p"/interests")
      |> assert_has("textarea", name: "user[interests]", text: "")
      |> assert_has("textarea", name: "user[favorite_media]", text: "")
      |> assert_has("textarea", name: "user[hobbies]", text: "")
      |> assert_has("textarea", name: "user[learning_struggles]", text: "")
      |> assert_has("textarea", name: "user[preferred_examples]", text: "")
      |> assert_has("input", name: "user[work_field]", value: "")
      |> assert_has("input", name: "user[location]", value: "")
    end

    test "allows very long text in all fields", %{conn: conn, user: user} do
      long_text = String.duplicate("This is a very long text with lots of content.", 500)

      conn
      |> visit(~p"/interests")
      |> fill_in("What are you interested in?", with: long_text)
      |> fill_in("What field do you work in?", with: long_text)
      |> fill_in("Where are you from?", with: long_text)
      |> submit()
      |> assert_path(~p"/interests")
      |> assert_has("p", text: "Done!")

      updated_interests = Repo.get_by!(UserInterests, user_id: user.id)
      assert updated_interests.interests == long_text
      assert updated_interests.work_field == long_text
      assert updated_interests.location == long_text
    end

    test "allows empty interests", %{conn: conn, user: user} do
      conn
      |> visit(~p"/interests")
      |> fill_in("What are you interested in?", with: "")
      |> fill_in("What are your hobbies?", with: "")
      |> submit()
      |> assert_path(~p"/interests")
      |> assert_has("p", text: "Done!")

      updated_interests = Repo.get_by!(UserInterests, user_id: user.id)
      refute updated_interests.interests
      refute updated_interests.hobbies
    end

    test "trims whitespace from interests", %{conn: conn, user: user} do
      conn
      |> visit(~p"/interests")
      |> fill_in("What are you interested in?", with: "  programming,  music  ,cooking,  ")
      |> submit()
      |> assert_path(~p"/interests")
      |> assert_has("p", text: "Done!")

      updated_interests = Repo.get_by!(UserInterests, user_id: user.id)
      assert updated_interests.interests == "programming,  music  ,cooking,"
    end

    test "shows interests menu item as active", %{conn: conn} do
      conn
      |> visit(~p"/interests")
      |> assert_has(".bg-zk-muted .sr-only", text: "Your interests")
    end
  end

  describe "interests form authorization" do
    test "redirects unauthenticated users to login", %{conn: conn} do
      conn
      |> visit(~p"/interests")
      |> assert_path(~p"/login")
    end
  end
end
