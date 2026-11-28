package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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

/** The Plan's way into a course's test opens a test taken before on its result, and offers a new one only while it can start. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanCourseOfferTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi().apply { placement = placementOf(next = null, status = "done") }
    private val planApi = FakePlanApi()

    private fun show(row: String) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        planApi.shownPlan = planWith(row)
        val plans = PlanStore(planApi, cache)
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
    fun aSavedResultWithNoTestToStartOpensThatResultWithDoneAndItsUndo() {
        show(RESULT_WITHOUT_OFFER)

        rule.onNodeWithText("You start here").assertIsDisplayed()
        rule.onNodeWithText("Why prices move").assertIsDisplayed()
        rule.onNodeWithContentDescription("4 lessons skipped").assertIsDisplayed()
        rule.onNodeWithContentDescription("4 of 9 lessons skipped").assertDoesNotExist()
        rule.onNodeWithText("News, results and expectations").assertIsDisplayed()
        rule.onNodeWithText("Undo").assertIsDisplayed()
        rule.onNodeWithText("Done").assertIsDisplayed()
        rule.onNodeWithText("Start").assertDoesNotExist()
        rule.onNodeWithText("Take the test again").assertDoesNotExist()
        rule.onNodeWithText("We'll see what you know in your first few days").assertDoesNotExist()
        assertEquals(0, api.sittingsStarted)
    }

    @Test
    fun aSavedResultWhoseChangeIsGoneOffersNoUndo() {
        show(RESULT_WITHOUT_OFFER.replace(CHANGE, "null"))

        rule.onNodeWithText("Why prices move").assertIsDisplayed()
        rule.onNodeWithText("Undo").assertDoesNotExist()
    }

    @Test
    fun aSavedResultWithATestThatCanStartOpensThatResultAndTakesTheTestAgainInPlace() {
        show(RESULT_WITH_OFFER)

        rule.onNodeWithText("Why prices move").assertIsDisplayed()
        rule.onNodeWithText("Undo").assertIsDisplayed()
        rule.onNodeWithText("Done").assertIsDisplayed()
        rule.onNodeWithText("Start").assertDoesNotExist()

        rule.onNodeWithText("Take the test again").performClick()

        rule.onNodeWithText("Up to 8 questions").assertIsDisplayed()
        rule.onNodeWithText("Start").assertIsDisplayed()
        rule.onNodeWithText("Not now").assertIsDisplayed()
        rule.onNodeWithText("Why prices move").assertDoesNotExist()
        assertEquals(0, api.sittingsStarted)
    }

    @Test
    fun undoOnASavedResultSaysTheLessonsAreBackAfterThePlanReadsAgainAndKeepsTheWayToRetake() {
        show(RESULT_WITH_OFFER)
        planApi.shownPlan = planWith(RESULT_WITH_OFFER.replace(CHANGE, "null").replace("\"lessonsSkipped\":4", "\"lessonsSkipped\":0"))

        rule.onNodeWithText("Undo").performClick()

        rule.onNodeWithText("No lessons skipped").assertIsDisplayed()
        rule.onNodeWithText("The lessons are back in your plan.").assertIsDisplayed()
        rule.onNodeWithText("Undo").assertDoesNotExist()
        rule.onNodeWithText("Take the test again").assertIsDisplayed()
    }

    @Test
    fun aResultThatSkippedNothingShowsNoLessonCount() {
        show(RESULT_WITHOUT_OFFER.replace(CHANGE, "null").replace("\"lessonsSkipped\":4", "\"lessonsSkipped\":0"))

        rule.onNodeWithText("Why prices move").assertIsDisplayed()
        rule.onNodeWithText("9 lessons", substring = true).assertDoesNotExist()
        rule.onNodeWithContentDescription("9 lessons", substring = true).assertDoesNotExist()
    }

    @Test
    fun aStartWithNoSavedNameIsCalledWhatThePlanCallsThatStop() {
        show(RESULT_WITHOUT_OFFER.replace("\"chapter\":\"Why prices move\"", "\"chapter\":null"))

        rule.onNodeWithText("You start here").assertIsDisplayed()
        rule.onNodeWithText("Phase 3").assertIsDisplayed()
        rule.onNodeWithText("Reading company news").assertDoesNotExist()
    }

    @Test
    fun aResultThatSkippedEveryLessonSaysSoOnceAsItsTitle() {
        val allSkipped =
            RESULT_WITHOUT_OFFER
                .replace(
                    "\"chapter\":\"Why prices move\"",
                    "\"chapter\":null",
                ).replace("\"start\":true", "\"start\":false")
        show(allSkipped)

        rule.onNodeWithText("4 lessons skipped").assertIsDisplayed()
        rule.onNodeWithContentDescription("4 lessons skipped").assertDoesNotExist()
        rule.onNodeWithText("You start here").assertDoesNotExist()
    }

    private fun planWith(row: String) = planOf().copy(placementTest = ApiJson.decodeFromString<PlanPlacementTest>(row))

    private companion object {
        const val START =
            """{"kind":"learn","state":"start","estimatedMinutes":4,"attempt":null,"result":null,
             "offer":{"estimatedMinutes":4,"questions":8}}"""

        const val CHANGE = "\"5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b\""

        const val RESULT =
            """{"attemptId":"0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d","finishedAt":"2026-11-18T14:00:00Z","lessonsSkipped":4,
              "changeId":$CHANGE,"chapter":"Why prices move",
              "course":{"lessons":9,"chapters":[{"done":0,"lessons":2,"skipped":2,"start":false},{"done":0,"lessons":2,"skipped":2,"start":false},
              {"done":0,"lessons":2,"skipped":0,"start":true},{"done":0,"lessons":3,"skipped":0,"start":false}]},
              "nextLesson":{"id":"6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c","title":"News, results and expectations","estimatedMinutes":5,
              "chapter":"Reading company news"}}"""

        const val RESULT_WITHOUT_OFFER =
            """{"kind":"learn","state":"result","estimatedMinutes":0,"attempt":null,"offer":null,"result":$RESULT}"""

        const val RESULT_WITH_OFFER =
            """{"kind":"learn","state":"result","estimatedMinutes":4,"attempt":null,"offer":{"estimatedMinutes":4,"questions":8},
             "result":$RESULT}"""
    }
}
