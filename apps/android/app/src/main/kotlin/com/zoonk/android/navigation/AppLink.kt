package com.zoonk.android.navigation

import java.net.URI
import java.net.URISyntaxException
import java.net.URLDecoder

/** Main's URLs as routes: App Links, and the paths the app's own content links (a buddy answer's `/session?block=…`). */
object AppLink {
    const val SITE_URL = "https://www.zoonk.com"

    private val hosts = setOf("zoonk.com", "www.zoonk.com")

    /** Main's `localePrefix: "as-needed"`: English pages have no prefix. */
    private val localePrefixes = setOf("de", "en", "es", "fr", "pt")

    /**
     * The route for one of main's pages: a `zoonk.com` URL or a path on it (`/pt/plan`), or null
     * when the app has no place for it (main's catalog pages by slug, the API's own pages). Query
     * parameters the app doesn't read are ignored, as main's pages ignore unknown ones.
     */
    fun parse(url: String): AppRoute? {
        val uri =
            try {
                URI(url)
            } catch (_: URISyntaxException) {
                return null
            }

        val isMainUrl = uri.scheme in setOf("https", "http") && uri.host?.lowercase() in hosts
        val isPath = uri.scheme == null && uri.rawAuthority == null && uri.rawPath.orEmpty().startsWith("/")

        if (!isMainUrl && !isPath) {
            return null
        }

        return try {
            val segments =
                uri.rawPath
                    .orEmpty()
                    .split('/')
                    .filter(String::isNotEmpty)
                    .map(::decodeSegment)
            val path = if (segments.firstOrNull() in localePrefixes) segments.drop(1) else segments
            route(path, query(uri.rawQuery))
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    fun webUrl(
        page: AppRoute.WebPage,
        language: String,
    ): String {
        val prefix = if (language in localePrefixes && language != "en") "/$language" else ""
        return "$SITE_URL$prefix${page.path}"
    }

    private fun route(
        path: List<String>,
        query: Map<String, String>,
    ): AppRoute? {
        val session = query["session"]

        val (first, second, third) = path + List(maxOf(0, 3 - path.size)) { "" }

        return when (path.size) {
            0 -> {
                AppRoute.Today
            }

            1 -> {
                when (first) {
                    "today" -> AppRoute.Today
                    "plan" -> AppRoute.Plan(focus = query["focus"])
                    "buddy" -> AppRoute.Buddy(ask = query["ask"])
                    "exam" -> AppRoute.Exam
                    "mind-maps" -> AppRoute.MindMaps
                    "mistakes" -> AppRoute.Mistakes
                    "speaking" -> AppRoute.Speaking
                    "settings" -> AppRoute.Settings
                    "profile" -> AppRoute.Profile
                    "subscription", "pricing" -> AppRoute.Subscription
                    "support" -> AppRoute.Help
                    "stats" -> AppRoute.Statistics
                    "level" -> AppRoute.StatsLevel
                    "energy" -> AppRoute.StatsEnergy
                    "activity" -> AppRoute.StatsActivity
                    "score" -> AppRoute.StatsScore
                    "patterns" -> AppRoute.StatsPatterns
                    "courses" -> AppRoute.Catalog()
                    "start" -> AppRoute.StartGoal(goal = query["goal"], planId = query["plan"])
                    "session" -> AppRoute.Session(blockId = query["block"], goalId = query["goal"])
                    "logbook" -> AppRoute.Logbook
                    "focus-test" -> AppRoute.FocusTest(goalId = query["goal"])
                    "pronunciation" -> AppRoute.Pronunciation(goalId = query["goal"])
                    "login" -> AppRoute.Login
                    "privacy" -> AppRoute.Privacy
                    "terms" -> AppRoute.Terms
                    "blog" -> AppRoute.Blog
                    else -> null
                }
            }

            2 -> {
                when (first) {
                    "plan" -> AppRoute.Subject(subjectKey = second)

                    "buddy" -> if (second == "earlier-questions") AppRoute.EarlierQuestions else null

                    "mock" -> if (second == "new") AppRoute.MockChooser else AppRoute.Mock(second, session)

                    "mistakes" -> if (second == "practice") AppRoute.MistakePractice(query["skill"]) else null

                    "settings" -> settingsPage(second)

                    // Each currency's pricing page becomes the in-app offer with Play's prices.
                    "pricing" -> AppRoute.Subscription

                    "courses" -> AppRoute.Catalog(category = second)

                    "start" -> AppRoute.GoalSetup(goalId = second)

                    "learn" -> AppRoute.Lesson(second, sessionId = session, firstAnswer = query["answer"])

                    "pattern" -> AppRoute.Pattern(patternId = second)

                    "test-out" -> AppRoute.TestOut(chapterId = second, sessionId = session)

                    "challenge" -> AppRoute.Challenge(planItemId = second, sessionId = session)

                    "checkpoint" -> AppRoute.Checkpoint(blockId = second, sessionId = session)

                    "essay" -> AppRoute.Essay(blockId = second)

                    "conversation" -> AppRoute.Conversation(conversationId = second)

                    "explain" -> AppRoute.Explain(goalId = second)

                    "plan-link" -> AppRoute.PlanLink(planId = second)

                    else -> null
                }
            }

            3 -> {
                when {
                    first == "content" && second == "chapters" -> AppRoute.Chapter(chapterId = third)
                    first == "content" && second == "units" -> AppRoute.LanguageUnit(chapterId = third)
                    first == "mock" && second == "placement" -> AppRoute.PlacementMock(goalId = third)
                    first == "start" && second == "course" -> courseStart(third, query)
                    else -> null
                }
            }

            else -> {
                null
            }
        }
    }

    private fun settingsPage(page: String): AppRoute? =
        when (page) {
            "appearance" -> AppRoute.Preferences
            "memory" -> AppRoute.Memory
            else -> null
        }

    private fun courseStart(
        courseId: String,
        query: Map<String, String>,
    ) = AppRoute.CourseStart(
        courseId = courseId,
        chapterId = query["chapter"],
        dailyMinutes = query["minutes"]?.toIntOrNull(),
    )

    /** The first value of each parameter, without empty ones (main reads `?goal=` as no goal). */
    private fun query(rawQuery: String?): Map<String, String> =
        rawQuery
            .orEmpty()
            .split('&')
            .mapNotNull { pair ->
                val (name, value) = pair.split('=', limit = 2).let { it[0] to it.getOrElse(1) { "" } }
                decodeQuery(value).takeIf(String::isNotEmpty)?.let { decodeQuery(name) to it }
            }.distinctBy { it.first }
            .toMap()

    private fun decodeQuery(value: String): String = URLDecoder.decode(value, "UTF-8")

    /** Paths keep `+` as itself; only query strings use it for a space. */
    private fun decodeSegment(segment: String): String = URLDecoder.decode(segment.replace("+", "%2B"), "UTF-8")
}
