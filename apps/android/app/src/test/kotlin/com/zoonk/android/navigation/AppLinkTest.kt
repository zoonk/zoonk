package com.zoonk.android.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppLinkTest {
    private val mainPages: List<Pair<String, AppRoute>> =
        listOf(
            "/" to AppRoute.Today,
            "/today" to AppRoute.Today,
            "/plan" to AppRoute.Plan(),
            "/plan?focus=choose" to AppRoute.Plan(focus = "choose"),
            "/buddy" to AppRoute.Buddy(),
            "/buddy?ask=What%20is%20osmosis%3F" to AppRoute.Buddy(ask = "What is osmosis?"),
            "/plan/biology" to AppRoute.Subject("biology"),
            "/content/chapters/chapter-1" to AppRoute.Chapter("chapter-1"),
            "/content/units/unit-1" to AppRoute.LanguageUnit("unit-1"),
            "/exam" to AppRoute.Exam,
            "/mock/new" to AppRoute.MockChooser,
            "/mind-maps" to AppRoute.MindMaps(),
            "/mind-maps#natural-sciences" to AppRoute.MindMaps(subject = "natural-sciences"),
            "/pt/mind-maps#ci%C3%AAncias" to AppRoute.MindMaps(subject = "ciências"),
            "/mistakes" to AppRoute.Mistakes,
            "/speaking" to AppRoute.Speaking(),
            "/speaking?task=2" to AppRoute.Speaking(task = "2"),
            "/buddy/earlier-questions" to AppRoute.EarlierQuestions,
            "/settings" to AppRoute.Settings,
            "/settings/appearance" to AppRoute.Preferences,
            "/settings/memory" to AppRoute.Memory,
            "/profile" to AppRoute.Profile,
            "/subscription" to AppRoute.Subscription,
            "/pricing" to AppRoute.Subscription,
            "/pricing/brl" to AppRoute.Subscription,
            "/support" to AppRoute.Help,
            "/stats" to AppRoute.Statistics,
            "/level" to AppRoute.StatsLevel,
            "/energy" to AppRoute.StatsEnergy,
            "/activity" to AppRoute.StatsActivity,
            "/score" to AppRoute.StatsScore,
            "/patterns" to AppRoute.StatsPatterns,
            "/courses" to AppRoute.Catalog(),
            "/courses/math" to AppRoute.Catalog(category = "math"),
            "/start" to AppRoute.StartGoal(),
            "/start?goal=Pass%20the%20ENEM&plan=plan-1" to AppRoute.StartGoal(goal = "Pass the ENEM", planId = "plan-1"),
            "/start?draft=draft-1" to AppRoute.StartGoal(draftId = "draft-1"),
            "/start/goal-1" to AppRoute.GoalSetup("goal-1"),
            "/start/course/course-1" to AppRoute.CourseStart("course-1"),
            "/start/course/course-1?chapter=chapter-2&minutes=30" to AppRoute.CourseStart("course-1", "chapter-2", 30),
            "/mock/placement/goal-1" to AppRoute.PlacementMock("goal-1"),
            "/session" to AppRoute.Session(),
            "/session?block=block-1" to AppRoute.Session(blockId = "block-1"),
            "/session?goal=goal-1" to AppRoute.Session(goalId = "goal-1"),
            "/session?stopped=1" to AppRoute.Session(stopped = true),
            "/logbook" to AppRoute.Logbook,
            "/learn/lesson-1" to AppRoute.Lesson("lesson-1"),
            "/learn/lesson-1?session=session-1&answer=b" to AppRoute.Lesson("lesson-1", "session-1", "b"),
            "/mistakes/practice" to AppRoute.MistakePractice(),
            "/mistakes/practice?skill=skill-1" to AppRoute.MistakePractice("skill-1"),
            "/pattern/pattern-1" to AppRoute.Pattern("pattern-1"),
            "/test-out/chapter-1" to AppRoute.TestOut("chapter-1"),
            "/test-out/chapter-1?session=session-1" to AppRoute.TestOut("chapter-1", "session-1"),
            "/focus-test" to AppRoute.FocusTest(),
            "/focus-test?goal=goal-1" to AppRoute.FocusTest("goal-1"),
            "/challenge/item-1" to AppRoute.Challenge("item-1"),
            "/challenge/item-1?session=session-1" to AppRoute.Challenge("item-1", "session-1"),
            "/checkpoint/block-1?session=session-1" to AppRoute.Checkpoint("block-1", "session-1"),
            "/essay/block-1" to AppRoute.Essay("block-1"),
            "/mock/block-1" to AppRoute.Mock("block-1"),
            "/mock/block-1?session=session-1" to AppRoute.Mock("block-1", "session-1"),
            "/pronunciation" to AppRoute.Pronunciation(),
            "/pronunciation?goal=goal-1" to AppRoute.Pronunciation("goal-1"),
            "/conversation/conversation-1" to AppRoute.Conversation("conversation-1"),
            "/conversation/conversation-1?from=exam" to AppRoute.Conversation("conversation-1", from = "exam"),
            "/conversation/conversation-1?mock=mock-1" to AppRoute.Conversation("conversation-1", mock = "mock-1"),
            "/explain/goal-1" to AppRoute.Explain("goal-1"),
            "/plan-link/plan-1" to AppRoute.PlanLink("plan-1"),
            "/login" to AppRoute.Login,
            "/privacy" to AppRoute.Privacy,
            "/terms" to AppRoute.Terms,
            "/blog" to AppRoute.Blog,
        )

    /** Routes without a page of their own on main: Android shows them alone, main inside another page. */
    private val routesWithoutMainPages =
        setOf(
            AppRoute.QuestionBlock::class.java,
            AppRoute.MindMap::class.java,
            // The API reads courses, chapters and lessons by id; main's catalog URLs carry slugs.
            AppRoute.CatalogCourse::class.java,
            AppRoute.CatalogChapter::class.java,
            AppRoute.CatalogLesson::class.java,
            // A link to main's subscription page opens Subscription; this one opens that page itself for web plans.
            AppRoute.WebSubscription::class.java,
            // A section of the terms, which links open as the terms.
            AppRoute.FairUse::class.java,
            // Main credits its dependencies on the web; the app lists its own.
            AppRoute.Licenses::class.java,
        )

    @Test
    fun parsesEveryMainPage() {
        mainPages.forEach { (path, route) ->
            assertEquals(path, route, AppLink.parse(path))
            assertEquals(path, route, AppLink.parse("https://www.zoonk.com$path"))
        }
    }

    @Test
    fun coversEveryRoute() {
        val linked = mainPages.map { it.second.javaClass }.toSet()
        assertEquals(everyRouteClass, linked + routesWithoutMainPages)
        assertEquals(everyRouteClass, routeSamples.map { it.javaClass }.toSet())
    }

    @Test
    fun dropsMainsLanguagePrefix() {
        listOf("de", "en", "es", "fr", "pt").forEach { language ->
            assertEquals(AppRoute.PlanLink("plan-1"), AppLink.parse("https://zoonk.com/$language/plan-link/plan-1"))
            assertEquals(AppRoute.Today, AppLink.parse("https://zoonk.com/$language"))
            assertEquals(AppRoute.Subject("history"), AppLink.parse("/$language/plan/history"))
        }

        assertNull(AppLink.parse("/it/plan-link/plan-1"))
    }

    @Test
    fun readsMainsHostsOnly() {
        assertEquals(AppRoute.Exam, AppLink.parse("https://zoonk.com/exam"))
        assertEquals(AppRoute.Exam, AppLink.parse("http://WWW.ZOONK.COM/exam"))
        assertNull(AppLink.parse("https://example.com/exam"))
        assertNull(AppLink.parse("https://zoonk.com.example.com/exam"))
        assertNull(AppLink.parse("//example.com/exam"))
        assertNull(AppLink.parse("mailto:hello@zoonk.com"))
        assertNull(AppLink.parse("exam"))
    }

    @Test
    fun readsQueryParametersAsMainDoes() {
        assertEquals(AppRoute.Session(), AppLink.parse("/session?block="))
        assertEquals(AppRoute.Session(blockId = "a"), AppLink.parse("/session?block=a&block=b"))
        assertEquals(AppRoute.Session(blockId = "a"), AppLink.parse("/session?preparing=1&block=a&limit=x"))
        assertEquals(AppRoute.Buddy(ask = "a + b"), AppLink.parse("/buddy?ask=a+%2B+b"))
        assertEquals(AppRoute.CourseStart("course-1"), AppLink.parse("/start/course/course-1?minutes=often"))
        assertEquals(AppRoute.Exam, AppLink.parse("/exam#notice"))
        assertEquals(AppRoute.Exam, AppLink.parse("/exam/"))
    }

    @Test
    fun decodesPathSegments() {
        assertEquals(AppRoute.Subject("língua portuguesa"), AppLink.parse("/plan/l%C3%ADngua%20portuguesa"))
        assertEquals(AppRoute.Subject("c++"), AppLink.parse("/plan/c++"))
    }

    @Test
    fun hasNoRouteForPagesTheAppDoesntOpen() {
        listOf(
            "/b/zoonk/c/biology",
            "/b/zoonk/c/biology/ch/cells/l/membranes",
            "/auth/apple?token=abc",
            "/catalog-not-found",
            "/settings/unknown",
            "/mistakes/unknown",
            "/buddy/unknown",
            "/content/lessons/lesson-1",
            "/today/extra",
            "/plan/biology/extra",
            "/%zz",
            "/session?block=%zz",
            "https://zoonk.com/exam?x=<script>",
        ).forEach { path -> assertNull(path, AppLink.parse(path)) }
    }

    @Test
    fun webPagesOpenInTheAppsLanguage() {
        assertEquals("https://www.zoonk.com/privacy", AppLink.webUrl(AppRoute.Privacy, "en"))
        assertEquals("https://www.zoonk.com/pt/terms", AppLink.webUrl(AppRoute.Terms, "pt"))
        assertEquals("https://www.zoonk.com/blog", AppLink.webUrl(AppRoute.Blog, "it"))
    }

    @Test
    fun anyPageOfMainHasItsUrlInTheAppsLanguage() {
        assertEquals("https://www.zoonk.com/plan-link/abc", AppLink.pageUrl("/plan-link/abc", "en"))
        assertEquals("https://www.zoonk.com/pt/plan-link/abc", AppLink.pageUrl("/plan-link/abc", "pt"))
        assertEquals("https://www.zoonk.com/plan-link/abc", AppLink.pageUrl("/plan-link/abc", "it"))
    }
}
