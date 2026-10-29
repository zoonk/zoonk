package com.zoonk.android.navigation

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

/**
 * Every page of main's app (`apps/main/src/app/[lang]`) as a typed route, plus the two screens
 * Android shows on their own where main draws them inside another page (a session's question
 * block, a mind map's viewer). [AppLink] reads main's URLs into them. Features open them only
 * through [AppNavigator], and each lane draws its own routes in its `<Name>Navigation.kt`.
 */
@Serializable
sealed interface AppRoute : NavKey {
    @Serializable
    data object Today : AppRoute

    /** `focus` opens the Plan to one of its choices (`time`, `choose`, `everything`), as Today's links do. */
    @Serializable
    data class Plan(
        val focus: String? = null,
    ) : AppRoute

    /** `ask` waits in the composer, as search leaves it: only the learner's own send asks it. */
    @Serializable
    data class Buddy(
        val ask: String? = null,
    ) : AppRoute

    @Serializable
    data class Subject(
        val subjectKey: String,
    ) : AppRoute

    @Serializable
    data class Chapter(
        val chapterId: String,
    ) : AppRoute

    @Serializable
    data class LanguageUnit(
        val chapterId: String,
    ) : AppRoute

    @Serializable
    data object Exam : AppRoute

    @Serializable
    data object MockChooser : AppRoute

    /** [subject] opens the grid at that subject's maps, as main's `/mind-maps#key` does. */
    @Serializable
    data class MindMaps(
        val subject: String? = null,
    ) : AppRoute

    @Serializable
    data object Mistakes : AppRoute

    /** [task] opens that task's row, as main's `?task=` does. */
    @Serializable
    data class Speaking(
        val task: String? = null,
    ) : AppRoute

    @Serializable
    data object EarlierQuestions : AppRoute

    @Serializable
    data object Settings : AppRoute

    @Serializable
    data object Preferences : AppRoute

    @Serializable
    data object Memory : AppRoute

    @Serializable
    data object Profile : AppRoute

    @Serializable
    data object Subscription : AppRoute

    @Serializable
    data object Help : AppRoute

    @Serializable
    data object Licenses : AppRoute

    @Serializable
    data object Statistics : AppRoute

    @Serializable
    data object StatsLevel : AppRoute

    @Serializable
    data object StatsEnergy : AppRoute

    @Serializable
    data object StatsActivity : AppRoute

    @Serializable
    data object StatsScore : AppRoute

    @Serializable
    data object StatsPatterns : AppRoute

    @Serializable
    data class Catalog(
        val category: String? = null,
    ) : AppRoute

    // The API reads courses, chapters and lessons by id; main's catalog URLs carry slugs.
    @Serializable
    data class CatalogCourse(
        val courseId: String,
    ) : AppRoute

    /** A shared chapter sits in several courses, numbered differently in each: `courseId` is the one it was opened from. */
    @Serializable
    data class CatalogChapter(
        val chapterId: String,
        val courseId: String,
    ) : AppRoute

    @Serializable
    data class CatalogLesson(
        val lessonId: String,
        val chapterId: String,
        val courseId: String,
    ) : AppRoute

    /**
     * `goal` fills the box (reading it waits for the learner's tap); `planId` starts from a shared
     * plan; `draftId` shows a goal already sent, which opening only reads.
     */
    @Serializable
    data class StartGoal(
        val goal: String? = null,
        val planId: String? = null,
        val draftId: String? = null,
    ) : AppRoute

    @Serializable
    data class GoalSetup(
        val goalId: String,
    ) : AppRoute

    /** `dailyMinutes` is the time a day the course's example plan showed. */
    @Serializable
    data class CourseStart(
        val courseId: String,
        val chapterId: String? = null,
        val dailyMinutes: Int? = null,
    ) : AppRoute

    @Serializable
    data class PlacementMock(
        val goalId: String,
    ) : AppRoute

    /** `blockId` opens one of today's blocks; `goalId` shows that goal's day before it has a saved block. */
    @Serializable
    data class Session(
        val blockId: String? = null,
        val goalId: String? = null,
    ) : AppRoute

    /** A practice or review block of a session, which main plays inside its session screen. */
    @Serializable
    data class QuestionBlock(
        val sessionId: String,
        val blockId: String,
    ) : AppRoute

    @Serializable
    data object Logbook : AppRoute

    /** `firstAnswer` is the option a visitor picked on the lesson's public page, checked as the first step. */
    @Serializable
    data class Lesson(
        val lessonId: String,
        val sessionId: String? = null,
        val firstAnswer: String? = null,
    ) : AppRoute

    @Serializable
    data class MistakePractice(
        val skillId: String? = null,
    ) : AppRoute

    @Serializable
    data class Pattern(
        val patternId: String,
    ) : AppRoute

    @Serializable
    data class TestOut(
        val chapterId: String,
        val sessionId: String? = null,
    ) : AppRoute

    /** Without `goalId`, the goal in the switcher. */
    @Serializable
    data class FocusTest(
        val goalId: String? = null,
    ) : AppRoute

    @Serializable
    data class Challenge(
        val planItemId: String,
        val sessionId: String? = null,
    ) : AppRoute

    @Serializable
    data class Checkpoint(
        val blockId: String,
        val sessionId: String? = null,
    ) : AppRoute

    @Serializable
    data class Essay(
        val blockId: String,
    ) : AppRoute

    @Serializable
    data class Mock(
        val blockId: String,
        val sessionId: String? = null,
    ) : AppRoute

    /** A chapter's mind map full screen, which main opens over its mind maps page. */
    @Serializable
    data class MindMap(
        val chapterId: String,
    ) : AppRoute

    @Serializable
    data class Pronunciation(
        val goalId: String? = null,
    ) : AppRoute

    /** [from] is `exam` for a task opened from the exam page, whose result leads back there; [mock] is the mock a call returns to. */
    @Serializable
    data class Conversation(
        val conversationId: String,
        val from: String? = null,
        val mock: String? = null,
    ) : AppRoute

    @Serializable
    data class Explain(
        val goalId: String,
    ) : AppRoute

    @Serializable
    data class PlanLink(
        val planId: String,
    ) : AppRoute

    @Serializable
    data object Login : AppRoute

    /** A page main keeps on the web (DECISIONS #5), which [AppNavigator] opens in a Custom Tab. */
    @Serializable
    sealed interface WebPage : AppRoute {
        /** The page's path on main, without the language. */
        val path: String
    }

    @Serializable
    data object Privacy : WebPage {
        override val path = "/privacy"
    }

    @Serializable
    data object Terms : WebPage {
        override val path = "/terms"
    }

    @Serializable
    data object Blog : WebPage {
        override val path = "/blog"
    }

    @Serializable
    data object FairUse : WebPage {
        override val path = "/terms#fair-use"
    }

    /** Where a Plus bought on the web is changed or canceled. */
    @Serializable
    data object WebSubscription : WebPage {
        override val path = "/subscription"
    }
}

sealed interface Presentation {
    data class Tab(
        val tab: AppTab,
    ) : Presentation

    data object Push : Presentation

    /** Pushed on the current tab too, and left as a whole: closing it returns to where it opened. */
    data class Section(
        val section: AppSection,
    ) : Presentation

    /** Full screen over the frame (no navigation bar, rail or drawer), with a close action. */
    data object Task : Presentation

    data object Web : Presentation
}

enum class AppSection {
    Settings,
    Statistics,
    Catalog,
    Onboarding,
}

/** What a screen needs before it can show anything of its own; [ShellGate] shows the rest. */
enum class Requirement {
    None,

    /** A session, a guest's included (main's `AuthGate`). */
    Account,

    Goal,
}

val AppRoute.presentation: Presentation
    get() =
        when (this) {
            AppRoute.Today -> Presentation.Tab(AppTab.Today)

            is AppRoute.Plan -> Presentation.Tab(AppTab.Plan)

            is AppRoute.Buddy -> Presentation.Tab(AppTab.Buddy)

            is AppRoute.Subject, is AppRoute.Chapter, is AppRoute.LanguageUnit, AppRoute.Exam,
            AppRoute.MockChooser, is AppRoute.MindMaps, AppRoute.Mistakes, is AppRoute.Speaking,
            AppRoute.EarlierQuestions,
            -> Presentation.Push

            AppRoute.Settings, AppRoute.Preferences, AppRoute.Memory, AppRoute.Profile,
            AppRoute.Subscription, AppRoute.Help, AppRoute.Licenses,
            -> Presentation.Section(AppSection.Settings)

            AppRoute.Statistics, AppRoute.StatsLevel, AppRoute.StatsEnergy, AppRoute.StatsActivity,
            AppRoute.StatsScore, AppRoute.StatsPatterns,
            -> Presentation.Section(AppSection.Statistics)

            is AppRoute.Catalog, is AppRoute.CatalogCourse, is AppRoute.CatalogChapter,
            is AppRoute.CatalogLesson,
            -> Presentation.Section(AppSection.Catalog)

            is AppRoute.StartGoal, is AppRoute.GoalSetup, is AppRoute.CourseStart,
            is AppRoute.PlacementMock,
            -> Presentation.Section(AppSection.Onboarding)

            is AppRoute.Session, is AppRoute.QuestionBlock, AppRoute.Logbook, is AppRoute.Lesson,
            is AppRoute.MistakePractice, is AppRoute.Pattern, is AppRoute.TestOut,
            is AppRoute.FocusTest, is AppRoute.Challenge, is AppRoute.Checkpoint, is AppRoute.Essay,
            is AppRoute.Mock, is AppRoute.MindMap, is AppRoute.Pronunciation,
            is AppRoute.Conversation, is AppRoute.Explain, is AppRoute.PlanLink, AppRoute.Login,
            -> Presentation.Task

            is AppRoute.WebPage -> Presentation.Web
        }

val AppRoute.requirement: Requirement
    get() =
        when (this) {
            is AppRoute.Plan, is AppRoute.Subject, is AppRoute.Chapter, is AppRoute.LanguageUnit,
            AppRoute.Exam, AppRoute.MockChooser, is AppRoute.MindMaps, is AppRoute.MindMap,
            AppRoute.Mistakes, is AppRoute.Speaking, is AppRoute.TestOut, is AppRoute.FocusTest,
            -> Requirement.Goal

            AppRoute.EarlierQuestions, AppRoute.Memory, AppRoute.Profile, AppRoute.Statistics,
            AppRoute.StatsLevel, AppRoute.StatsEnergy, AppRoute.StatsActivity, AppRoute.StatsScore,
            AppRoute.StatsPatterns, is AppRoute.GoalSetup, is AppRoute.PlacementMock,
            is AppRoute.Session, is AppRoute.QuestionBlock, AppRoute.Logbook,
            is AppRoute.MistakePractice, is AppRoute.Pattern, is AppRoute.Challenge,
            is AppRoute.Checkpoint, is AppRoute.Essay, is AppRoute.Mock, is AppRoute.Pronunciation,
            is AppRoute.Conversation, is AppRoute.Explain,
            -> Requirement.Account

            else -> Requirement.None
        }

val AppRoute.section: AppSection?
    get() = (presentation as? Presentation.Section)?.section

/**
 * The tab a page belongs to (main's `TAB_PATHS`), where a link from outside the app opens it: the
 * Plan's pages on the Plan, the buddy's on the buddy, everything else on Today.
 */
val AppRoute.homeTab: AppTab
    get() =
        when (this) {
            is AppRoute.Plan, is AppRoute.Subject, is AppRoute.Chapter, is AppRoute.LanguageUnit,
            AppRoute.Exam, AppRoute.MockChooser, is AppRoute.MindMaps,
            -> AppTab.Plan

            is AppRoute.Buddy, AppRoute.EarlierQuestions -> AppTab.Buddy

            else -> AppTab.Today
        }
