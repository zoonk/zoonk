package com.zoonk.android.feature.buddy

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.label
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The glasses sheet and the name editor each ask for their own save: glasses picked, the sheet dismissed and the
 * editor opened with a new name typed before the glasses save lands, the editor stays open with its draft.
 */
@RunWith(AndroidJUnit4::class)
class BuddyChangesTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aGlassesSaveThatLandsAfterTheEditorOpenedLeavesItsDraft() = check(fails = false)

    @Test
    fun aGlassesSaveThatFailsAfterTheEditorOpenedSaysNothingThere() = check(fails = true)

    private fun check(fails: Boolean) {
        val held = CompletableDeferred<Unit>()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), scope)
        val vm =
            BuddyViewModel(
                BuddyStore(NoStatusApi, cache, { "UTC" }, cache.resource(Audience.SignedIn) { learnerSummary() }, scope),
                LearningProfileStore(ProfileApi(held, fails), cache),
                StudyOpener(FakeStudyApi(), { _, _ -> error("Not used") }, cache, { "UTC" }),
            )
        var open by mutableStateOf(BuddyChangesOpen(glasses = true, editor = false))
        var editorClosed = 0
        compose.setContent {
            ZoonkTheme {
                BuddyChanges(
                    vm,
                    STATUS,
                    STATUS.look(),
                    open,
                    closeGlasses = { open = open.copy(glasses = false) },
                    closeEditor = {
                        editorClosed++
                        open = open.copy(editor = false)
                    },
                )
            }
        }
        try {
            compose.onNodeWithText(compose.activity.getString(BuddyGlasses.Star.label)).performClick()
            compose.runOnIdle { open = open.copy(glasses = false) }
            compose.runOnIdle { open = open.copy(editor = true) }
            compose.onNode(hasSetTextAction()).performTextReplacement("Nox")

            held.complete(Unit)
            compose.waitForIdle()

            assertEquals(0, editorClosed)
            compose.onNode(hasSetTextAction()).assertTextContains("Nox")
            compose.onNodeWithText(compose.activity.getString(R.string.settings_preferences_save_failed)).assertDoesNotExist()
        } finally {
            scope.cancel()
        }
    }

    private object NoStatusApi : BuddyApi {
        override suspend fun status(
            session: AuthenticatedSession,
            timeZone: String,
        ): BuddyStatus = error("Not used")
    }

    private class ProfileApi(
        private val held: CompletableDeferred<Unit>,
        private val fails: Boolean,
    ) : LearningProfileApi {
        override suspend fun profile(session: AuthenticatedSession): LearningProfile = throw ApiException(ApiError.Network)

        override suspend fun update(
            session: AuthenticatedSession,
            change: JsonObject,
        ): LearningProfile {
            held.await()
            if (fails) throw ApiException(ApiError.Network)
            return ApiJson.decodeFromString(PROFILE)
        }
    }

    private companion object {
        const val PROFILE =
            """{"activeGoalId":null,"availableGlasses":["round","star"],"homeCountry":null,"homeCountryName":null,"suggested":[],"buddy":{"glasses":"star","kind":"zu","name":null,"picked":true},"shareUsageData":null,"soundsEnabled":true}"""

        val STATUS: BuddyStatus by lazy {
            ApiJson.decodeFromString(
                """
                {"belt":{"bpPerLevel":100,"bpToNextLevel":40,"color":"white","isMaxLevel":false,"level":2,"progressInLevel":60,"totalBrainPower":160},
                 "buddy":{"glasses":"round","kind":"zu","name":null,"picked":true},
                 "energy":{"current":64,"state":"awake","studiedToday":false},
                 "firstSteps":null,
                 "glasses":[{"current":1,"earned":true,"glasses":"round","target":1},{"current":1,"earned":true,"glasses":"star","target":1}],
                 "nextStage":{"belt":"yellow","brainPowerToGo":240,"stage":"young"},
                 "stage":"baby",
                 "thisWeek":{"fixes":0,"newIdeas":3,"reviews":1},
                 "today":null}
                """.trimIndent(),
            )
        }
    }
}
