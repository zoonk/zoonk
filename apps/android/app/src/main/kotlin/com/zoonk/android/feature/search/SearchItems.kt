package com.zoonk.android.feature.search

import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.PlaceIcon
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.CatalogSearchResponse
import com.zoonk.api.models.ExamMockSummary
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Syllabus
import java.text.Normalizer
import java.util.UUID
import kotlin.math.roundToLong

internal sealed interface SearchAction {
    data class Open(
        val route: AppRoute,
    ) : SearchAction

    data class ShowTab(
        val tab: AppTab,
    ) : SearchAction

    data class SwitchGoal(
        val goalId: UUID,
    ) : SearchAction

    data object SignOut : SearchAction
}

/** [keywords] and [detail] are searched with the label: searching the next block's name keeps Continue. */
internal data class SearchItem(
    val id: String,
    val label: String,
    val action: SearchAction,
    val detail: String? = null,
    val keywords: String = "",
    val count: Long? = null,
    @param:DrawableRes val icon: Int? = null,
) {
    val searchValue: String get() = listOfNotNull(label, keywords, detail).joinToString(" ")
}

internal data class SearchGroup(
    val id: String,
    val label: String,
    val items: List<SearchItem>,
)

/** What search reads besides the words: the learner (null for a visitor) and the results of their query. */
internal data class SearchSources(
    val summary: LearnerSummary?,
    val signedIn: Boolean,
    val catalog: CatalogSearchResponse?,
    val syllabus: Syllabus?,
    val mocks: List<ExamMockSummary>,
)

/** Main's `normalizeString`: accent- and case-insensitive, spaces collapsed. */
internal fun normalizeSearch(text: String): String =
    Normalizer
        .normalize(text, Normalizer.Form.NFD)
        .replace(DIACRITICS, "")
        .lowercase()
        .replace(SPACES, " ")
        .trim()

internal fun matchesSearch(
    query: String,
    value: String,
): Boolean = normalizeSearch(query).let { it.isEmpty() || normalizeSearch(value).contains(it) }

/** Main's palette groups: the learner's actions and places (or a visitor's pages), what the query found, then help and a fallback. */
@Composable
internal fun searchGroups(
    query: String,
    sources: SearchSources,
): List<SearchGroup> {
    val searching = query.isNotBlank()
    val summary = sources.summary
    val learner = sources.signedIn
    val isLoggedIn = summary?.identity?.isAnonymous == false
    val active = summary?.goals?.firstOrNull { it.isActive }
    val canAskBuddy = active != null && active.kind != LearnerSummaryGoal.Kind.EXPLAIN
    val buddy = summary?.buddy?.let { buddyName(BuddyKind.of(it.kind.value), it.name) }
    val settings = settingsItems(isLoggedIn)

    val general =
        if (learner) {
            learnerGroups(summary, searching, canAskBuddy, buddy, settings)
        } else {
            listOf(visitorPages(searching, settings))
        }

    val searched =
        if (searching) {
            listOf(planGroup(query, sources.syllabus), mocksGroup(query, sources.mocks), catalogGroup(query, sources))
        } else {
            emptyList()
        }

    val help =
        if (searching || !learner) {
            listOf(
                SearchGroup(
                    "account",
                    stringResource(R.string.search_group_account),
                    listOfNotNull(
                        SearchItem("logout", stringResource(R.string.search_log_out), SearchAction.SignOut).takeIf { isLoggedIn },
                    ),
                ),
                SearchGroup(
                    "help",
                    stringResource(R.string.search_group_help),
                    listOf(
                        SearchItem("blog", stringResource(R.string.search_blog), SearchAction.Open(AppRoute.Blog)),
                        SearchItem("feedback", stringResource(R.string.search_send_feedback), SearchAction.Open(AppRoute.Help)),
                        SearchItem("support", stringResource(R.string.search_help), SearchAction.Open(AppRoute.Help)),
                    ),
                ),
            )
        } else {
            emptyList()
        }

    val fallback = if (searching) fallbackGroup(query.trim(), learner, canAskBuddy, buddy) else null

    return (filtered(general, query) + searched + filtered(help, query) + listOfNotNull(fallback)).filter { it.items.isNotEmpty() }
}

private fun filtered(
    groups: List<SearchGroup>,
    query: String,
) = groups.map { group -> group.copy(items = group.items.filter { matchesSearch(query, it.searchValue) }) }

@Composable
private fun learnerGroups(
    summary: LearnerSummary?,
    searching: Boolean,
    canAskBuddy: Boolean,
    buddy: String?,
    settings: List<SearchItem>,
): List<SearchGroup> {
    val locale = currentLocale()
    val places = summary?.places
    val next = summary?.today?.next
    val readyMistakes = places?.readyMistakes ?: 0
    val activeGoalId = summary?.activeGoalId ?: summary?.goals?.firstOrNull()?.id

    val actions =
        listOfNotNull(
            next?.let {
                val minutes = formatDuration((it.minutes * SECONDS_PER_MINUTE).roundToLong(), locale)
                SearchItem(
                    "continue",
                    stringResource(R.string.search_continue),
                    SearchAction.Open(AppRoute.Session()),
                    it.title?.let { title -> "$title · $minutes" } ?: minutes,
                )
            },
            SearchItem(
                "mock",
                stringResource(R.string.search_take_mock),
                SearchAction.Open(AppRoute.MockChooser),
                stringResource(R.string.search_take_mock_detail),
            ).takeIf { places?.exam == true },
            SearchItem(
                "practice-mistakes",
                stringResource(R.string.search_practice_mistakes),
                SearchAction.Open(AppRoute.MistakePractice()),
                count = readyMistakes,
            ).takeIf { readyMistakes > 0 },
            buddy?.let { SearchItem("ask", stringResource(R.string.search_ask_buddy, it), SearchAction.Open(AppRoute.Buddy())) }?.takeIf {
                !searching &&
                    canAskBuddy
            },
            SearchItem(
                "start",
                stringResource(R.string.search_start_new_goal),
                SearchAction.Open(AppRoute.StartGoal()),
            ).takeIf { searching },
        )

    val goTo =
        listOfNotNull(
            SearchItem("today", stringResource(R.string.navigation_today), SearchAction.ShowTab(AppTab.Today), icon = PlaceIcon.Today.icon),
            SearchItem("plan", stringResource(R.string.navigation_plan), SearchAction.ShowTab(AppTab.Plan), icon = PlaceIcon.Plan.icon),
            buddy?.let {
                SearchItem(
                    "buddy",
                    it,
                    SearchAction.ShowTab(AppTab.Buddy),
                    keywords = stringResource(R.string.search_buddy_keyword),
                    icon = PlaceIcon.Buddy.icon,
                )
            },
            SearchItem(
                "mistakes",
                stringResource(R.string.search_mistakes_notebook),
                SearchAction.Open(AppRoute.Mistakes),
                count = readyMistakes.takeIf { it > 0 },
                icon = PlaceIcon.Mistakes.icon,
            ),
            SearchItem(
                "exam",
                stringResource(R.string.navigation_exam),
                SearchAction.Open(AppRoute.Exam),
                icon = PlaceIcon.Exam.icon,
            ).takeIf {
                places?.exam ==
                    true
            },
            SearchItem(
                "speaking",
                stringResource(R.string.navigation_speaking),
                SearchAction.Open(AppRoute.Speaking),
                icon = PlaceIcon.Speaking.icon,
            ).takeIf { places?.speaking == true },
            SearchItem(
                "mind-maps",
                stringResource(R.string.navigation_mind_maps),
                SearchAction.Open(AppRoute.MindMaps),
                icon = PlaceIcon.MindMaps.icon,
            ).takeIf { places?.mindMaps == true },
            SearchItem("logbook", stringResource(R.string.search_logbook), SearchAction.Open(AppRoute.Logbook)),
            SearchItem(
                "stats",
                stringResource(R.string.navigation_statistics),
                SearchAction.Open(AppRoute.Statistics),
                icon = PlaceIcon.Statistics.icon,
            ),
            SearchItem("courses", stringResource(R.string.catalog_title), SearchAction.Open(AppRoute.Catalog())).takeIf { searching },
        ) + if (searching) settings else emptyList()

    val goals = summary?.goals.orEmpty()
    val otherGoals =
        goals
            .filter { it.kind != LearnerSummaryGoal.Kind.EXPLAIN && it.id != activeGoalId }
            .map { SearchItem("goal-${it.id}", stringResource(R.string.search_switch_goal, it.title), SearchAction.SwitchGoal(it.id)) }
    val explanations =
        if (searching) {
            goals
                .filter { it.kind == LearnerSummaryGoal.Kind.EXPLAIN }
                .reversed()
                .map { SearchItem("explanation-${it.id}", it.title, SearchAction.Open(AppRoute.Explain(it.id.toString()))) }
        } else {
            emptyList()
        }

    return listOf(
        SearchGroup("actions", stringResource(R.string.search_group_actions), actions),
        SearchGroup("pages", stringResource(R.string.search_group_go_to), goTo),
        SearchGroup("goals", stringResource(R.string.search_group_goals), otherGoals),
        SearchGroup("explanations", stringResource(R.string.search_group_explanations), explanations),
    )
}

@Composable
private fun visitorPages(
    searching: Boolean,
    settings: List<SearchItem>,
): SearchGroup =
    SearchGroup(
        "pages",
        stringResource(R.string.search_group_go_to),
        listOf(
            SearchItem("home", stringResource(R.string.search_home), SearchAction.ShowTab(AppTab.Today)),
            SearchItem("courses", stringResource(R.string.catalog_title), SearchAction.Open(AppRoute.Catalog())),
            SearchItem("start", stringResource(R.string.search_start_goal), SearchAction.Open(AppRoute.StartGoal())),
        ) + (if (searching) settings else emptyList()) +
            listOf(
                SearchItem("pricing", stringResource(R.string.search_pricing), SearchAction.Open(AppRoute.Subscription)),
                SearchItem("login", stringResource(R.string.search_log_in), SearchAction.Open(AppRoute.Login)),
            ),
    )

@Composable
private fun settingsItems(isLoggedIn: Boolean): List<SearchItem> {
    val keyword = stringResource(R.string.search_settings)

    return listOfNotNull(
        SearchItem("settings", keyword, SearchAction.Open(AppRoute.Settings)),
        SearchItem("profile", stringResource(R.string.search_profile), SearchAction.Open(AppRoute.Profile), keywords = keyword).takeIf {
            isLoggedIn
        },
        SearchItem(
            "memory",
            stringResource(R.string.search_memory),
            SearchAction.Open(AppRoute.Memory),
            keywords = keyword,
        ).takeIf { isLoggedIn },
        SearchItem(
            "subscription",
            stringResource(R.string.search_subscription),
            SearchAction.Open(AppRoute.Subscription),
            keywords = keyword,
        ).takeIf { isLoggedIn },
        SearchItem(
            "appearance",
            stringResource(R.string.search_preferences),
            SearchAction.Open(AppRoute.Preferences),
            keywords = keyword + " " + stringResource(R.string.search_appearance),
        ),
        SearchItem("language", stringResource(R.string.search_language), SearchAction.Open(AppRoute.Preferences), keywords = keyword),
    )
}

/** A chapter whose lessons are still being written has no page yet. */
@Composable
private fun planGroup(
    query: String,
    syllabus: Syllabus?,
): SearchGroup {
    val subjects = syllabus?.subjects.orEmpty()
    val language = syllabus?.goal?.kind?.value == "language"
    val subjectItems =
        subjects
            .filter { matchesSearch(query, "${it.name} ${it.shortName}") }
            .take(MAX_PLAN_SUBJECTS)
            .map { SearchItem("subject-${it.key}", it.name, SearchAction.Open(AppRoute.Subject(it.key))) }
    val chapterItems =
        subjects
            .flatMap { subject ->
                subject.chapters.mapNotNull { chapter ->
                    val chapterId = chapter.chapterId?.toString() ?: return@mapNotNull null
                    val route = if (language) AppRoute.LanguageUnit(chapterId) else AppRoute.Chapter(chapterId)
                    SearchItem("plan-chapter-$chapterId", chapter.title, SearchAction.Open(route), subject.shortName)
                        .takeIf { matchesSearch(query, chapter.title) }
                }
            }.take(MAX_PLAN_CHAPTERS)

    return SearchGroup("plan", stringResource(R.string.search_group_plan), subjectItems + chapterItems)
}

@Composable
private fun mocksGroup(
    query: String,
    mocks: List<ExamMockSummary>,
): SearchGroup {
    val locale = currentLocale()
    val items =
        mocks
            .mapNotNull { mock ->
                mock.blockId?.let {
                    SearchItem(
                        "mock-$it",
                        stringResource(R.string.search_mock_exam, formatNumber(mock.number.toDouble(), locale)),
                        SearchAction.Open(AppRoute.Mock(it.toString())),
                    )
                }
            }.filter { matchesSearch(query, it.label) }
            .take(MAX_MOCKS)

    return SearchGroup("mocks", stringResource(R.string.search_group_mocks), items)
}

/**
 * Main's ranking: titles that hold the query first, then (for a query long enough to mean
 * something) what matched on its description; chapters already in the learner's plan show there.
 */
@Composable
private fun catalogGroup(
    query: String,
    sources: SearchSources,
): SearchGroup {
    val results = sources.catalog
    val planChapters =
        sources.syllabus
            ?.subjects
            .orEmpty()
            .flatMap { it.chapters }
            .mapNotNull { it.chapterId }
            .toSet()
    val longQuery = normalizeSearch(query).length >= MIN_DESCRIPTION_QUERY_LENGTH

    fun <T> ranked(
        items: List<T>,
        title: (T) -> String,
    ) = items.filter { matchesSearch(query, title(it)) } +
        if (longQuery) items.filterNot { matchesSearch(query, title(it)) } else emptyList()

    val courses =
        ranked(results?.courses.orEmpty()) { it.title }.map {
            SearchItem(
                "course-${it.id}",
                it.title,
                SearchAction.Open(AppRoute.CatalogCourse(it.id.toString())),
                it.description,
                icon = R.drawable.ic_library_books,
            )
        }
    val chapters =
        ranked(results?.chapters.orEmpty().filter { it.id !in planChapters }) { it.title }.map {
            SearchItem(
                "chapter-${it.id}",
                it.title,
                SearchAction.Open(AppRoute.CatalogChapter(it.id.toString(), it.courseId.toString())),
                it.courseTitle,
                icon = R.drawable.ic_menu_book,
            )
        }

    return SearchGroup(
        "catalog",
        stringResource(R.string.search_group_catalog),
        (courses + chapters).sortedByDescending { matchesSearch(query, it.label) },
    )
}

@Composable
private fun fallbackGroup(
    question: String,
    learner: Boolean,
    canAskBuddy: Boolean,
    buddy: String?,
): SearchGroup {
    val ask =
        buddy?.takeIf { canAskBuddy }?.let {
            SearchItem(
                "fallback-ask",
                stringResource(R.string.search_ask_question, it, question),
                SearchAction.Open(AppRoute.Buddy(ask = question)),
                stringResource(R.string.search_ask_detail),
            )
        }
    val start =
        SearchItem(
            "fallback-start",
            stringResource(if (learner) R.string.search_start_new_goal_named else R.string.search_start_goal_named, question),
            SearchAction.Open(AppRoute.StartGoal(goal = question)),
        )

    return SearchGroup(
        "fallback",
        stringResource(if (ask != null) R.string.search_group_ask else R.string.search_group_new_goal),
        listOfNotNull(ask, start),
    )
}

private val DIACRITICS = Regex("\\p{Mn}+")
private val SPACES = Regex("\\s+")
private const val SECONDS_PER_MINUTE = 60
private const val MAX_PLAN_SUBJECTS = 4
private const val MAX_PLAN_CHAPTERS = 6
private const val MAX_MOCKS = 6
private const val MIN_DESCRIPTION_QUERY_LENGTH = 5
