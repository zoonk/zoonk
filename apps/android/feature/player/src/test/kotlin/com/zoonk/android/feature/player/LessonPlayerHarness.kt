package com.zoonk.android.feature.player

import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.activities.code.CodeSandbox
import com.zoonk.android.feature.activities.code.LocalCodeSandbox
import com.zoonk.android.feature.audio.previewSpeech
import com.zoonk.android.feature.catalog.CatalogStore
import com.zoonk.android.feature.catalog.FakeCatalogApi
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.feature.goalcontent.GoalContentStore
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.feature.tutor.TutorSuggestion
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import java.io.File
import java.util.UUID

/** Plays a lesson in the real player against [FakeLessonPlayerApi], recording where it leads. */
internal class LessonPlayerHarness(
    private val rule: ComposeContentTestRule,
    private val newFolder: () -> File,
) {
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")
    val session = FakeSession(ana)
    var closed = 0
    lateinit var api: FakeLessonPlayerApi
    val catalogApi = FakeCatalogApi()
    lateinit var catalog: CatalogStore
    val chapterApi = FakeChapterApi()
    lateinit var chapters: GoalContentStore
    lateinit var cache: AppCache
    val chapterKey = ChapterKey(UUID.fromString(GOAL_ID), UUID.fromString(CHAPTER_ID))
    lateinit var openAgain: () -> LessonPlayerViewModel

    /** What Android keeps for the screen when it closes the app in the background; a view model opened again reads it. */
    var saved = SavedStateHandle()
    lateinit var viewModel: LessonPlayerViewModel

    /** The code templates' sandbox; by default one whose page can't open. */
    var codeSandbox: (CoroutineScope) -> CodeSandbox = { CodeSandbox(openPage = { null }, scope = it) }

    val exits =
        object : LessonPlayerExits {
            override fun close() {
                closed++
            }

            override fun open(route: AppRoute) = Unit

            override fun replace(route: AppRoute) = Unit
        }

    fun play(
        steps: List<LessonStep>,
        restoration: StateRestorationTester? = null,
        pictures: PrivatePictures? = null,
        layoutDirection: LayoutDirection? = null,
        withTutor: Boolean = false,
        withSpeech: Boolean = false,
        configure: FakeLessonPlayerApi.() -> Unit = {},
    ) {
        val lesson = playable(steps)
        api = FakeLessonPlayerApi(LessonLoad.Ready(lesson)).apply(configure)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        cache = AppCache(session, scope)
        catalog = CatalogStore(catalogApi, cache)
        chapters = GoalContentStore(chapterApi, cache)
        val drafts = DraftStore(newFolder(), scope, io = Dispatchers.Main.immediate)
        runBlocking { drafts.follow { DraftsChange(ana.accountId) } }
        saved = SavedStateHandle()
        val store = LessonPlayerStore(api, cache)
        val newViewModel = {
            LessonPlayerViewModel(
                lessonId = LESSON_ID,
                studySessionId = null,
                firstAnswer = null,
                store = store,
                cache = cache,
                sessions = session,
                choices = TodayChoices(drafts),
                drafts = drafts,
                activeGoalId = { GOAL_ID },
                lessonStarted = catalog.lessonStarted[LESSON_ID],
                chapters = chapters,
                saved = saved,
            )
        }
        viewModel = newViewModel()
        val sandbox = codeSandbox(scope)
        openAgain = { newViewModel().also { it.open(lesson) } }

        val content: @Composable () -> Unit = {
            ZoonkTheme {
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalCodeSandbox provides sandbox,
                    LocalPrivatePictures provides pictures,
                    LocalLayoutDirection provides (layoutDirection ?: LocalLayoutDirection.current),
                    LocalLessonSpeech provides if (withSpeech) previewSpeech() else null,
                ) {
                    val state by viewModel.state.collectAsState()
                    val ending by viewModel.ending.collectAsState()
                    LaunchedEffect(Unit) { viewModel.open(lesson) }
                    LearnerInput(viewModel::act) {
                        LessonPlayer(
                            lesson,
                            state,
                            ending,
                            viewModel,
                            exits,
                            rememberAppNavigator(),
                            tutor =
                                if (withTutor) {
                                    LessonTutor(TutorIdentity("Sam", look = null), LESSON_SUGGESTIONS) { _, _, _, _, _, onOpenChange ->
                                        TextButton(onClick = { onOpenChange(true) }) { Text("Ask buddy") }
                                    }
                                } else {
                                    null
                                },
                        )
                    }
                }
            }
        }
        if (restoration != null) restoration.setContent(content) else rule.setContent(content)
        rule.waitUntil {
            api.startGate?.let { api.startOpenings.isNotEmpty() } ?: viewModel.state.value
                ?.run
                .let { it is LessonRun.Started || it is LessonRun.Refused }
        }
    }

    fun tap(text: String) = rule.onNodeWithText(text).performClick()
}

private const val GOAL_ID = "00000000-0000-4000-8000-000000000011"

private val LESSON_SUGGESTIONS =
    listOf(TutorSuggestion("Explain it more simply", "simpler"), TutorSuggestion("I want to go deeper", "deeper"))
