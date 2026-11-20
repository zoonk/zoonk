package com.zoonk.android.feature.settings

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A buddy change saved, its editor closed and opened again with a new name typed before that save lands: the
 * editor open now stays, with its draft, and isn't told about a save it didn't ask for.
 */
@RunWith(AndroidJUnit4::class)
class PreferencesBuddyEditorTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aSaveFromAnEarlierEditorThatLandsLeavesTheOpenOneAndItsDraft() = check(fails = false)

    @Test
    fun aSaveFromAnEarlierEditorThatFailsSaysNothingInTheOpenOne() = check(fails = true)

    @Test
    fun anOpenEditorComesBackAfterTheProcessIsReclaimed() {
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob()))
        val store = LearningProfileStore(ProfileApi(CompletableDeferred(), fails = false), cache)
        val handle = SavedStateHandle()
        PreferencesViewModel(store, handle).editBuddy(true)

        val restored = PreferencesViewModel(store, SavedStateHandle.createHandle(handle.savedStateProvider().saveState(), null))

        assertTrue(restored.isEditingBuddy)
    }

    private fun check(fails: Boolean) {
        val held = CompletableDeferred<Unit>()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), scope)
        val preferences = PreferencesViewModel(LearningProfileStore(ProfileApi(held, fails), cache), SavedStateHandle())
        val profile = ApiJson.decodeFromString<LearningProfile>(PROFILE)
        compose.setContent { ZoonkTheme { BuddySection(profile, BuddyLook(), preferences) } }

        fun click(text: Int) = compose.onNodeWithText(compose.activity.getString(text)).performClick()
        try {
            click(R.string.settings_preferences_change)
            click(R.string.settings_save)
            click(R.string.settings_cancel)
            click(R.string.settings_preferences_change)
            compose.onNode(hasSetTextAction()).performTextReplacement("Nox")

            held.complete(Unit)
            compose.waitForIdle()

            compose.onNode(hasSetTextAction()).assertTextContains("Nox")
            compose.onNodeWithText(compose.activity.getString(R.string.settings_preferences_save_failed)).assertDoesNotExist()
        } finally {
            scope.cancel()
        }
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
            """{"activeGoalId":null,"availableGlasses":["round"],"homeCountry":null,"homeCountryName":null,"suggested":[],"buddy":{"glasses":"round","kind":"zu","name":null,"picked":true},"shareUsageData":null,"soundsEnabled":true}"""
    }
}
