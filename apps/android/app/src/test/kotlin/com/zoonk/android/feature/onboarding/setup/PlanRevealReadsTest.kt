package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.CountingApi
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.settle
import com.zoonk.android.data.waitFor
import com.zoonk.android.feature.onboarding.examGoal
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.feature.plan.LivePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PlanRevealReadsTest {
    @get:Rule
    val rule = createComposeRule()

    private val goal = examGoal()
    private val plan = "/goals/${goal.id}/plan"
    private val syllabus = "/goals/${goal.id}/syllabus"
    private val api =
        CountingApi(
            mapOf(
                plan to ApiJson.encodeToString(planOf()),
                syllabus to ApiJson.encodeToString(syllabusOf(emptyList(), kind = "modules")),
            ),
        )

    @After
    fun stop() = api.close()

    @Test
    fun thePlanRevealAndThePlanTabReadAGoalsPlanAndSyllabusOnce() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token-a", "local-a"))
        val cache = AppCache(session, scope)
        val plans = PlanStore(LivePlanApi(api.clients), cache)
        var planTab by mutableStateOf(false)

        rule.setContent {
            ZoonkTheme {
                Column {
                    if (planTab) {
                        plans.plan[goal.id].collectShown()
                        plans.syllabus[goal.id].collectShown()
                    } else {
                        PlanRevealStep(
                            goal,
                            false,
                            null,
                            GenerationRun(status = GenerationRun.Status.Ready),
                            null,
                            plans,
                            rememberAppNavigator(),
                        )
                    }
                }
            }
        }
        rule.waitFor { api.requests(plan) == 1 && api.requests(syllabus) == 1 }
        rule.waitForIdle()
        rule.runOnIdle { planTab = true }
        rule.settle(plans.plan[goal.id], plans.syllabus[goal.id])

        assertEquals(1 to 1, api.requests(plan) to api.requests(syllabus))
    }
}
