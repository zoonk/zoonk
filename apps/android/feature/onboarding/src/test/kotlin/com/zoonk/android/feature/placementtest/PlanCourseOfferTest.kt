package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanPlacementTest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/** The Plan's way into a course's test offers Start only while the server can open one. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanCourseOfferTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi().apply { placement = placementOf(next = null, status = "done") }

    private fun show(row: String) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val plans =
            PlanStore(
                FakePlanApi().apply { shownPlan = planOf().copy(placementTest = ApiJson.decodeFromString<PlanPlacementTest>(row)) },
                cache,
            )
        val vm = PlacementTestViewModel(GOAL_ID, store, SavedStateHandle())
        rule.setContent {
            ZoonkTheme {
                Column {
                    SetupColumn {
                        PlacementTestFlow(
                            UUID.fromString(GOAL_ID),
                            "Stock market",
                            store,
                            plans,
                            {},
                            rememberAppNavigator(),
                            vm,
                        )
                    }
                }
            }
        }
    }

    @Test
    fun aTestThatCanOpenIsOfferedWithItsSize() {
        show(START)

        rule.onNodeWithText("Up to 8 questions").assertIsDisplayed()
        rule.onNodeWithText("Start").assertIsDisplayed()
    }

    @Test
    fun aTestTheServerCannotOpenAgainHasNoStartOnlyDone() {
        show(RESULT_WITHOUT_OFFER)

        rule.onNodeWithText("We'll see what you know in your first few days").assertIsDisplayed()
        rule.onNodeWithText("Done").assertIsDisplayed()
        rule.onNodeWithText("Start").assertDoesNotExist()
        assertEquals(0, api.sittingsStarted)
    }

    private companion object {
        const val START =
            """{"kind":"learn","state":"start","estimatedMinutes":4,"attempt":null,"result":null,
             "offer":{"estimatedMinutes":4,"questions":8}}"""

        const val RESULT_WITHOUT_OFFER =
            """{"kind":"learn","state":"result","estimatedMinutes":0,"attempt":null,"offer":null,
             "result":{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-18T14:00:00Z","lessonsSkipped":6,
              "chapter":null,"course":null,"nextLesson":null}}"""
    }
}
