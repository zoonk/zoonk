package com.zoonk.android.feature.today

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.SnackbarHost
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.app.rememberWindowSnackbars
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.focustest.unusedFocusTests
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.SESSION
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Today
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** Today's answer after the exam's date saves in the view model, so a failure it reports reaches the window the learner has then. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class TodayExamOverWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<ExamOverTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aFailedAnswerShowsInTheWindowRecreatedWhileItSaved() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = ExamOverTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val held = CompletableDeferred<Unit>()
        val plans = FakePlanApi().apply { gates[PlanOp.FullCourse(true)] = held }
        val main = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), main)
        val today = decodeFixture<Today>("today", "goal" to EXAM_GOAL, "session" to PAST_DATE_DAY, "progress" to PAST_DATE)
        val store = TodayStore(FakeTodayApi(listOf(today)), cache, main, timeZone = { "UTC" })
        ExamOverTest.app = AppContainer.preview(application)
        ExamOverTest.store = store
        ExamOverTest.read = TodayRead.Day(today, today.session.toDayView())
        ExamOverTest.viewModel =
            TodayViewModel(
                StudyOpener(FakeStudyApi(), { _, _ -> error("Not used") }, cache, timeZone = { "UTC" }),
                store,
                PlanStore(plans, cache),
                unusedFocusTests(cache),
            )
        scenario = ActivityScenario.launch(ExamOverTestActivity::class.java)

        rule.onNodeWithText("Keep studying").performClick()
        scenario.recreate()
        plans.changeFailure = ApiException(ApiError.Network)
        held.complete(Unit)

        rule.onNodeWithText("That didn't save. Try again.").assertIsDisplayed()
    }

    private companion object {
        val EXAM_GOAL =
            buildJsonObject {
                put("dateEstimated", false)
                put("daysLeft", null as Int?)
                put("id", "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")
                put("kind", "exam")
                put("targetDate", "2026-11-01")
                put("title", "ENEM")
                put("displayName", "ENEM")
            }

        val PAST_DATE =
            buildJsonObject {
                put("measure", "preparation")
                put(
                    "status",
                    buildJsonObject {
                        put("kind", "pastDate")
                        put("lessons", 4)
                    },
                )
                put("value", 0.6)
                put("weekGain", 0.0)
            }

        val PAST_DATE_DAY =
            JsonObject(
                fixture(
                    "study-session",
                    "id" to SESSION.toString(),
                    "status" to "active",
                    "state" to "rest",
                    "blocks" to JsonArray(emptyList()),
                    "nextPosition" to null,
                    "minutes" to
                        buildJsonObject {
                            put("dailyGoal", 0)
                            put("left", 0)
                            put("done", 0)
                            put("planned", 0)
                        },
                ) +
                    (
                        "sessionBar" to
                            buildJsonObject {
                                put("completed", 0)
                                put("total", 0)
                            }
                    ),
            )
    }
}

/** What outlives [ExamOverTestActivity]'s recreations, as the app's container and a navigation entry's view model do. */
object ExamOverTest {
    lateinit var app: AppContainer
    lateinit var store: TodayStore
    lateinit var read: TodayRead.Day
    lateinit var viewModel: TodayViewModel
}

class ExamOverTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                val snackbars = rememberWindowSnackbars(ExamOverTest.app)

                CompositionLocalProvider(LocalSnackbarHostState provides snackbars) {
                    Box {
                        TodayDay(
                            ExamOverTest.read,
                            ExamOverTest.store.today,
                            false,
                            ExamOverTest.viewModel,
                            rememberAppNavigator(),
                            PaddingValues(),
                            buddy = BuddyLook(),
                            buddyName = "Zu",
                            snackbars = ExamOverTest.app.snackbars,
                            refreshIfChanged = { false },
                        )
                        SnackbarHost(snackbars, Modifier.align(Alignment.BottomCenter))
                    }
                }
            }
        }
    }
}
