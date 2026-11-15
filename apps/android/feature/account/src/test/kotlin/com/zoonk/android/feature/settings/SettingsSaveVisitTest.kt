package com.zoonk.android.feature.settings

import androidx.lifecycle.ViewModelStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A setting that didn't save says so in the app's snackbars only on the visit that changed it: one that fails while
 * the page is recreated is owed once to the next frame; one that fails after the learner left says nothing anywhere.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class SettingsSaveVisitTest {
    private val held = CompletableDeferred<Unit>()

    private fun check(body: suspend TestScope.(LearningProfileStore, ViewModelStore) -> Unit) =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val models = ViewModelStore()
            try {
                val api =
                    object : LearningProfileApi {
                        override suspend fun profile(session: AuthenticatedSession): LearningProfile = throw ApiException(ApiError.Network)

                        override suspend fun update(
                            session: AuthenticatedSession,
                            change: JsonObject,
                        ): LearningProfile {
                            held.await()
                            throw ApiException(ApiError.Network)
                        }
                    }
                val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), backgroundScope)
                body(LearningProfileStore(api, cache), models)
            } finally {
                models.clear()
                Dispatchers.resetMain()
            }
        }

    @Test
    fun aPrivacySwitchThatFailsAfterTheLearnerLeftSaysNothingAnywhere() =
        check { store, models ->
            val privacy = PrivacyViewModel(store).also { models.put("privacy", it) }

            privacy.setShareUsageData(true)
            runCurrent()
            privacy.visit.end()
            held.complete(Unit)
            runCurrent()

            assertNull(privacy.saveFailed.value)
        }

    @Test
    fun aPrivacySwitchThatFailsWhileThePageIsRecreatedSaysSoOnce() =
        check { store, models ->
            val privacy = PrivacyViewModel(store).also { models.put("privacy", it) }

            privacy.setShareUsageData(true)
            held.complete(Unit)
            runCurrent()

            assertNotNull(privacy.saveFailed.value)
            privacy.saveFailed.acted(Unit)
            assertNull(privacy.saveFailed.value)
        }

    @Test
    fun aPreferenceThatFailsAfterTheLearnerLeftSaysNothingAnywhere() =
        check { store, models ->
            val preferences = PreferencesViewModel(store).also { models.put("preferences", it) }

            preferences.setSoundsEnabled(false)
            runCurrent()
            preferences.visit.end()
            held.complete(Unit)
            runCurrent()

            assertNull(preferences.saveFailed.value)
        }

    @Test
    fun aPreferenceThatFailsWhileThePageIsRecreatedSaysSoOnce() =
        check { store, models ->
            val preferences = PreferencesViewModel(store).also { models.put("preferences", it) }

            preferences.setSoundsEnabled(false)
            held.complete(Unit)
            runCurrent()

            assertNotNull(preferences.saveFailed.value)
        }
}
