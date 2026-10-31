package com.zoonk.android.feature.account

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.GUEST
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.summary
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.time.Instant
import kotlin.time.Duration.Companion.hours

private class FakeBirthYearApi : LearningProfileApi {
    val checked = mutableListOf<Long>()
    val checkRefusals = ArrayDeque<ApiException>()
    val saved = mutableListOf<Pair<String, Long>>()
    val refusals = ArrayDeque<ApiException>()
    var birthYear: Long? = null

    private val profile: LearningProfile =
        ApiJson.decodeFromString(
            """
            {"activeGoalId":null,"availableGlasses":["round"],"birthYear":null,"buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},
             "dailyLimitMinutes":null,"dailyTimes":[5,10,15],"shareUsageData":null,"soundsEnabled":true,"usageDataLockedOff":false}
            """.trimIndent(),
        )

    suspend fun check(birthYear: Long) {
        yield()
        checkRefusals.removeFirstOrNull()?.let { throw it }
        checked += birthYear
    }

    override suspend fun profile(session: AuthenticatedSession) = profile.copy(birthYear = birthYear)

    override suspend fun update(
        session: AuthenticatedSession,
        change: JsonObject,
    ) = profile(session)

    override suspend fun saveBirthYear(
        session: AuthenticatedSession,
        birthYear: Long,
    ): LearningProfile {
        yield()
        refusals.removeFirstOrNull()?.let { throw it }
        saved += session.accountId to birthYear
        this.birthYear = this.birthYear ?: birthYear
        return profile(session)
    }
}

private class MemoryAgeStops : AgeStops {
    var stop: AgeStop? = null

    override fun last() = stop

    override fun remember(stop: AgeStop) {
        this.stop = stop
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class BirthYearGateTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val sessionApi = FakeSessionApi().apply { accounts += mapOf("token-a" to ANA, "token-g" to GUEST) }
    private val credentials = MemoryCredentials()
    private val api = FakeBirthYearApi()
    private val stops = MemoryAgeStops()
    private var guestsStarted = 0
    private var afterGuestStarts = {}
    private var now = Instant.parse("2026-10-31T12:00:00Z").toEpochMilli()

    private lateinit var sessions: SessionStore

    private fun belowMinimumAge(minimumAge: Int) =
        ApiException(ApiError.Unavailable, "BELOW_MINIMUM_AGE", 422, buildJsonObject { put("minimumAge", minimumAge) })

    private suspend fun TestScope.gate(): BirthYearGate {
        val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        lateinit var cache: AppCache
        sessions =
            SessionStore(
                sessionApi,
                credentials,
                DraftStore(folder.root, main, io = StandardTestDispatcher(testScheduler)),
                onChange = { _, _ -> cache.followSession() },
                clearCredentialState = {},
            )
        cache = AppCache(sessions, main)
        val summary =
            cache.resource(Audience.SignedIn, DataDomain.entries.toSet()) { session ->
                session?.let { summary(readAt = 0, nextChangeAt = 0).copy(needsBirthYear = api.birthYear == null) }
            }
        val profile = LearningProfileStore(api, cache)
        val gate =
            BirthYearGate(
                sessions = sessions,
                summary = summary,
                checkAge = api::check,
                startGuestSession = {
                    guestsStarted++
                    sessions.signIn(asGuest = true) { "token-g" }.also { afterGuestStarts() }
                },
                saveBirthYear = profile::saveBirthYear,
                stops = stops,
                onSignOutFailed = {},
                scope = main,
                now = { now },
            )
        sessions.restore()
        summary.load()
        advanceUntilIdle()
        return gate
    }

    private fun question(
        canClose: Boolean,
        error: BirthYearError? = null,
    ) = BirthYearPrompt.Question(canClose, saving = false, error = error)

    @Test
    fun aVisitorAnswersThenStartsAsAGuestWhoseYearIsSaved() =
        runTest {
            val gate = gate()

            val started = async { gate.startGuest() }
            runCurrent()
            assertEquals(question(canClose = true), gate.prompt.value)
            assertEquals(0, guestsStarted)

            gate.answer(1990)
            advanceUntilIdle()

            assertEquals(SignInResult.SignedIn, started.await())
            assertEquals(listOf(1990L), api.checked)
            assertEquals(GUEST, sessions.current?.accountId)
            assertEquals(listOf(GUEST to 1990L), api.saved)
            assertNull(gate.prompt.value)
        }

    @Test
    fun theYearIsSavedWhenTheScreenThatAskedLeavesOnceTheGuestStarts() =
        runTest {
            val gate = gate()
            lateinit var started: Deferred<SignInResult>
            afterGuestStarts = { started.cancel() }

            started = async { gate.startGuest() }
            runCurrent()
            gate.answer(1990)
            advanceUntilIdle()

            assertTrue(started.isCancelled)
            assertEquals(listOf(GUEST to 1990L), api.saved)
            assertNull(gate.prompt.value)
        }

    @Test
    fun aVisitorBelowTheMinimumAgeGetsNoGuestAndCantTryAnotherYearForADay() =
        runTest {
            val gate = gate()
            api.checkRefusals += belowMinimumAge(14)

            val started = async { gate.startGuest() }
            runCurrent()
            gate.answer(2014)
            advanceUntilIdle()

            assertEquals(SignInResult.Obsolete, started.await())
            assertEquals(0, guestsStarted)
            assertNull(sessions.current)
            assertTrue(api.saved.isEmpty())
            assertEquals(AgeStop(14, now), stops.stop)
            assertEquals(BirthYearPrompt.BelowMinimumAge(14, logsOut = false), gate.prompt.value)

            gate.closeBelowMinimumAge()
            runCurrent()
            assertNull(gate.prompt.value)

            now += 23.hours.inWholeMilliseconds
            assertEquals(SignInResult.Obsolete, gate.startGuest())
            runCurrent()
            assertEquals(BirthYearPrompt.BelowMinimumAge(14, logsOut = false), gate.prompt.value)
            assertEquals(listOf<Long>(), api.checked)
            assertEquals(0, guestsStarted)
        }

    @Test
    fun theQuestionComesBackADayAfterABelowMinimumAnswer() =
        runTest {
            stops.stop = AgeStop(13, now - 24.hours.inWholeMilliseconds)
            val gate = gate()

            val started = async { gate.startGuest() }
            runCurrent()

            assertEquals(question(canClose = true), gate.prompt.value)
            gate.close()
            assertEquals(SignInResult.Obsolete, started.await())
        }

    @Test
    fun aRefusedYearOrAFailedCheckIsAskedAgainWithoutStartingAGuest() =
        runTest {
            val gate = gate()
            api.checkRefusals += ApiException(ApiError.Unavailable, "INVALID_BIRTH_YEAR", 422)
            api.checkRefusals += ApiException(ApiError.Network)

            val started = async { gate.startGuest() }
            runCurrent()
            gate.answer(2999)
            advanceUntilIdle()
            assertEquals(question(canClose = true, BirthYearError.Invalid), gate.prompt.value)
            gate.answer(1990)
            advanceUntilIdle()
            assertEquals(question(canClose = true, BirthYearError.NotSaved), gate.prompt.value)
            assertEquals(0, guestsStarted)

            gate.answer(1990)
            advanceUntilIdle()
            assertEquals(SignInResult.SignedIn, started.await())
            assertEquals(1, guestsStarted)
        }

    @Test
    fun closingTheQuestionStartsNothing() =
        runTest {
            val gate = gate()

            val started = async { gate.startGuest() }
            runCurrent()
            gate.close()

            assertEquals(SignInResult.Obsolete, started.await())
            runCurrent()
            assertEquals(0, guestsStarted)
            assertNull(gate.prompt.value)
        }

    @Test
    fun aYearThatDidntSaveIsAskedAgainForTheSameGuest() =
        runTest {
            val gate = gate()
            api.refusals += ApiException(ApiError.Network)

            val started = async { gate.startGuest() }
            runCurrent()
            gate.answer(1990)
            advanceUntilIdle()
            assertEquals(question(canClose = false, BirthYearError.NotSaved), gate.prompt.value)

            gate.answer(1990)
            advanceUntilIdle()

            assertEquals(SignInResult.SignedIn, started.await())
            assertEquals(1, guestsStarted)
            assertEquals(listOf(1990L), api.checked)
            assertEquals(listOf(GUEST to 1990L), api.saved)
        }

    @Test
    fun aSignedInAccountWithoutAYearIsAskedOverEveryScreenUntilItsSaved() =
        runTest {
            credentials.stored = StoredSession(AuthenticatedSession(ANA, "token-a", "local-a"))
            val gate = gate()
            assertEquals(question(canClose = false), gate.prompt.value)

            gate.answer(1990)
            advanceUntilIdle()

            assertEquals(listOf(ANA to 1990L), api.saved)
            assertTrue(api.checked.isEmpty())
            assertNull(gate.prompt.value)
        }

    @Test
    fun anAccountBelowTheMinimumAgeIsToldItWillBeLoggedOutThenIsOnOk() =
        runTest {
            credentials.stored = StoredSession(AuthenticatedSession(ANA, "token-a", "local-a"))
            val gate = gate()
            api.refusals += belowMinimumAge(13)

            gate.answer(2014)
            advanceUntilIdle()

            assertEquals(AgeStop(13, now), stops.stop)
            assertEquals(BirthYearPrompt.BelowMinimumAge(13, logsOut = true), gate.prompt.value)
            assertTrue(sessions.state.value is SessionState.SignedIn)

            gate.closeBelowMinimumAge()
            advanceUntilIdle()

            assertTrue(sessions.state.value is SessionState.SignedOut)
            assertEquals(listOf("token-a"), sessionApi.revoked)
            assertNull(gate.prompt.value)
        }

    @Test
    fun anAccountSignedInAgainWhileTheDeviceRemembersSeesTheMessageInsteadAndIsSignedOut() =
        runTest {
            stops.stop = AgeStop(14, now - 1.hours.inWholeMilliseconds)
            credentials.stored = StoredSession(AuthenticatedSession(ANA, "token-a", "local-a"))
            val gate = gate()
            assertEquals(BirthYearPrompt.BelowMinimumAge(14, logsOut = true), gate.prompt.value)

            gate.closeBelowMinimumAge()
            advanceUntilIdle()

            assertTrue(sessions.state.value is SessionState.SignedOut)
            assertNull(gate.prompt.value)
            assertTrue(api.saved.isEmpty())
        }
}
