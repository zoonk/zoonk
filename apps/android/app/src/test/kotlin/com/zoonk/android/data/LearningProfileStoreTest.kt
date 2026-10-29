package com.zoonk.android.data

import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

private const val PROFILE =
    """{"activeGoalId":null,"availableGlasses":["round"],"buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},"dailyLimitMinutes":45,"soundsEnabled":true}"""

private class FakeLearningProfileApi : LearningProfileApi {
    val changes = mutableListOf<JsonObject>()
    var failure: ApiException? = null
    var current: LearningProfile = ApiJson.decodeFromString(PROFILE)

    override suspend fun profile(session: AuthenticatedSession) = current

    override suspend fun update(
        session: AuthenticatedSession,
        change: JsonObject,
    ): LearningProfile {
        failure?.let { throw it }
        changes += change
        return current
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class LearningProfileStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val api = FakeLearningProfileApi()

    private suspend fun TestScope.loaded(): LearningProfileStore {
        val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += "token-a" to ANA },
                MemoryCredentials(StoredSession(AuthenticatedSession(ANA, "token-a", "local-a"))),
                DraftStore(folder.root, main, io = StandardTestDispatcher(testScheduler)),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        sessions.restore()
        val store = LearningProfileStore(api, AppCache(sessions, main))
        store.profile.load()
        advanceUntilIdle()
        return store
    }

    @Test
    fun noLimitIsSentAsAnExplicitNullAndKeptOnceSaved() =
        runTest {
            val store = loaded()
            api.current = api.current.copy(dailyLimitMinutes = null)

            assertTrue(store.setDailyLimit(null))

            assertEquals("""{"dailyLimitMinutes":null}""", api.changes.single().toString())
            assertNull(
                store.profile.state.value.value!!
                    .dailyLimitMinutes,
            )
        }

    @Test
    fun aRefusedChangeShowsTheSavedProfileAgain() =
        runTest {
            val store = loaded()
            api.failure = ApiException(ApiError.Unavailable, "INTERNAL_ERROR", 500)

            assertFalse(store.setSoundsEnabled(false))
            store.profile.load()
            advanceUntilIdle()

            assertTrue(
                store.profile.state.value.value!!
                    .soundsEnabled,
            )
        }

    @Test
    fun aLaterSavedChangeSurvivesAnEarlierOneFailing() =
        runTest {
            val store = loaded()
            api.failure = ApiException(ApiError.Unavailable, "INTERNAL_ERROR", 500)
            val sounds = async { store.setSoundsEnabled(false) }
            runCurrent()
            api.failure = null
            api.current = api.current.copy(dailyLimitMinutes = 90)
            val limit = async { store.setDailyLimit(90) }

            assertFalse(sounds.await())
            assertTrue(limit.await())
            store.profile.load()
            advanceUntilIdle()

            assertEquals(
                90L,
                store.profile.state.value.value!!
                    .dailyLimitMinutes,
            )
            assertTrue(
                store.profile.state.value.value!!
                    .soundsEnabled,
            )
        }

    @Test
    fun theLiveApiSendsTheChangeAsIs() =
        runTest {
            MockWebServer().use { server ->
                server.start()
                server.enqueue(
                    MockResponse
                        .Builder()
                        .code(200)
                        .addHeader("Content-Type", "application/json")
                        .body("""{"profile":$PROFILE}""")
                        .build(),
                )
                val api = LiveLearningProfileApi(ApiClients(server.url("/v1/"), apiHttpClient()))

                api.update(
                    AuthenticatedSession(ANA, "token-a", "local-a"),
                    kotlinx.serialization.json.buildJsonObject {
                        put("dailyLimitMinutes", kotlinx.serialization.json.JsonNull)
                    },
                )

                val sent = server.takeRequest()
                assertEquals("PATCH", sent.method)
                assertEquals("""{"dailyLimitMinutes":null}""", sent.body!!.utf8())
            }
        }
}
