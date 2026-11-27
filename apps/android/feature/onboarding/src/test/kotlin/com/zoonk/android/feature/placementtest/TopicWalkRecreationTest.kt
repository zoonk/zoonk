package com.zoonk.android.feature.placementtest

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.GOAL
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.plan.plan
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import java.util.UUID

/**
 * A language course's walk closes its attempt with its last answer, so the plan read after it says there's no walk.
 * Its result stays on screen through a recreation (a theme change, a rotation) instead of handing over to the level test.
 */
@RunWith(AndroidJUnit4::class)
class TopicWalkRecreationTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<TopicWalkActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aFinishedWalkStaysThroughARecreation() {
        val api = FakePlanApi().apply { shownPlan = plan(""""placementTest":$WALKING""") }
        launch(api)
        rule.onNodeWithText(WALK).assertExists()

        api.shownPlan = plan(""""placementTest":$FINISHED""")
        scope.launch { TopicWalkHost.plans.plan[UUID.fromString(GOAL)].refresh() }
        rule.waitForIdle()
        rule.onNodeWithText(WALK).assertExists()

        scenario.recreate()
        rule.waitForIdle()

        rule.onNodeWithText(WALK).assertExists()
    }

    @Test
    fun aFailedFirstPlanReadCanBeRetriedIntoAnOngoingWalk() {
        val api =
            FakePlanApi().apply {
                planFailure = ApiException(ApiError.Network)
                shownPlan = plan(""""placementTest":$WALKING""")
            }
        launch(api)
        rule.onNodeWithText("Try again").assertExists()

        api.planFailure = null
        rule.onNodeWithText("Try again").performClick()
        rule.onNodeWithText(WALK).assertExists()
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private fun launch(api: FakePlanApi) {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = TopicWalkActivity::class.java.name
                packageName = application.packageName
            },
        )
        TopicWalkHost.plans = PlanStore(api, AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), scope))
        scenario = ActivityScenario.launch(TopicWalkActivity::class.java)
    }

    private companion object {
        const val WALKING =
            """{"kind":"language","state":"continue","estimatedMinutes":25,"result":null,
             "attempt":{"id":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","length":"wholeCourse","part":2,"partComplete":false,"estimatedMinutes":25,"answered":0,"chapter":null,"nextPart":null,"parts":2,"partsLeft":1,"questions":12,"resume":null,"totalEstimatedMinutes":25}}"""

        const val FINISHED =
            """{"kind":"language","state":"result","estimatedMinutes":30,"attempt":null,"nextTestOutLevel":"B2",
             "result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-18T14:00:00Z","lessonsSkipped":12,
              "levelsSkipped":["A1"],"ranges":{"reading":{"low":"B1","high":"B2"}}}}"""
    }
}

private const val WALK = "walk"

/** What outlives [TopicWalkActivity]'s recreations, as the app's container does. */
object TopicWalkHost {
    lateinit var plans: PlanStore
}

class TopicWalkActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Column {
                LanguageTestEntry(TopicWalkHost.plans, UUID.fromString(GOAL)) { walking, _ -> Text(if (walking) WALK else "level") }
            }
        }
    }
}
