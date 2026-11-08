package com.zoonk.android.feature.reminders

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.shell.GoalSwitch
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearningProfile
import com.zoonk.api.models.PushPlatform
import com.zoonk.api.models.StudyReminder
import com.zoonk.api.models.StudyReminderEmail
import com.zoonk.api.models.StudyReminderOfferClaim
import com.zoonk.api.models.StudyReminderPhone
import com.zoonk.api.models.StudyReminderPush
import com.zoonk.api.models.StudyReminderPushPhone
import com.zoonk.api.models.StudyReminderUpdate
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import java.util.UUID

private val reviewAna = AuthenticatedSession(ANA, "token-a", "local-a")

private fun reviewReminder(
    token: String? = null,
    on: Boolean = false,
) = StudyReminder(
    email = StudyReminderEmail(address = "ana@zoonk.test", on = false),
    push = StudyReminderPush(on = on, phone = token?.let { StudyReminderPushPhone("Pixel", PushPlatform.ANDROID, it) }),
    quiet = false,
    time = "19:00",
    timeZone = "America/Sao_Paulo",
)

private class ReviewReminderApi : StudyReminderApi {
    val saved = mutableMapOf(ANA to reviewReminder())
    val writes = mutableListOf<String>()
    var readGate: CompletableDeferred<Unit>? = null
    var selectGate: CompletableDeferred<Unit>? = null
    var offline = false

    override suspend fun reminder(session: AuthenticatedSession): StudyReminder {
        val snapshot = saved.getValue(session.accountId)
        readGate?.await()
        return snapshot
    }

    override suspend fun update(
        session: AuthenticatedSession,
        update: StudyReminderUpdate,
    ): StudyReminder {
        val before = saved.getValue(session.accountId)
        return before.copy(push = before.push.copy(on = update.pushOn ?: before.push.on)).also {
            writes += "patch ${session.accountId} ${update.pushOn}"
            saved[session.accountId] = it
        }
    }

    override suspend fun claimOffer(
        session: AuthenticatedSession,
        claim: StudyReminderOfferClaim,
    ) = true

    override suspend fun selectPhone(
        session: AuthenticatedSession,
        phone: StudyReminderPhone,
    ): StudyReminder {
        selectGate?.await()
        if (offline) throw ApiException(ApiError.Network)
        // Mirrors study-reminder-phone.ts: selecting a token clears its previous owner's phone.
        saved.keys
            .toList()
            .filter {
                it != session.accountId && saved
                    .getValue(it)
                    .push.phone
                    ?.token == phone.token
            }.forEach {
                saved[it] = saved.getValue(it).copy(push = StudyReminderPush(on = false, phone = null))
            }
        val before = saved.getValue(session.accountId)
        return before.copy(push = before.push.copy(phone = StudyReminderPushPhone(phone.label, phone.platform, phone.token))).also {
            writes += "select ${session.accountId} ${phone.token}"
            saved[session.accountId] = it
        }
    }
}

private class ReviewPush : PushAddress {
    override var token: String? = null
    override val label = "Pixel"

    override suspend fun register() = "fid-new"

    override suspend fun save(token: String) {
        this.token = token
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class ReminderAdversarialReviewTest {
    @get:Rule
    val folder = TemporaryFolder()

    @Test
    fun turningPushOffDuringPhoneSelectionMustRemainOff() =
        runTest {
            val api = ReviewReminderApi()
            val selected = CompletableDeferred<Unit>()
            api.selectGate = selected
            val session = FakeSession(reviewAna)
            val cache = AppCache(session, backgroundScope)
            val store = StudyReminderStore(api, cache, ReviewPush(), session) { "en" }

            val enabling = async { store.turnOnPush() }
            runCurrent()
            store.update(pushOn = false)
            selected.complete(Unit)
            enabling.await()

            assertFalse(
                "Last action was Push off; requests: ${api.writes}",
                api.saved
                    .getValue(ANA)
                    .push.on,
            )
        }

    @Test
    fun failedRefreshMustStillBeRecoverableOnTheNextRegistration() =
        runTest {
            val context = ApplicationProvider.getApplicationContext<Context>()
            context
                .getSharedPreferences("push", Context.MODE_PRIVATE)
                .edit()
                .clear()
                .commit()
            val push = FirebasePush(context)
            push.save("fid-old")
            val api = ReviewReminderApi()
            api.saved[ANA] = reviewReminder("fid-old", on = true)
            val session = FakeSession(reviewAna)
            val store = StudyReminderStore(api, AppCache(session, backgroundScope), push, session) { "en" }

            // What ReminderMessagingService.onRegistered does with each callback.
            api.offline = true
            store.follow("fid-new")
            assertEquals("A failed upload keeps the token the server has, so the next callback tries again", "fid-old", push.token)
            api.offline = false
            store.follow("fid-new")

            assertEquals(
                "Local token ${push.token} permanently replaced the old token before upload succeeded",
                "fid-new",
                api.saved
                    .getValue(ANA)
                    .push.phone
                    ?.token,
            )
            assertEquals("fid-new", push.token)
        }

    @Test
    fun aColdTapMustSwitchAfterStoredCredentialsFinishLoading() =
        runTest {
            val stored = MemoryCredentials(StoredSession(reviewAna))
            val loaded = CompletableDeferred<Unit>()
            val credentials =
                object : SessionCredentials by stored {
                    override suspend fun read(): StoredSession? {
                        loaded.await()
                        return stored.read()
                    }
                }
            val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val sessions =
                SessionStore(
                    FakeSessionApi().apply { accounts["token-a"] = ANA },
                    credentials,
                    DraftStore(folder.root, main, io = StandardTestDispatcher(testScheduler)),
                    onChange = { _, _ -> },
                    clearCredentialState = {},
                )
            val changes = mutableListOf<JsonObject>()
            val profile: LearningProfile =
                ApiJson.decodeFromString(
                    """{"activeGoalId":null,"availableGlasses":["round"],"buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},"dailyLimitMinutes":45,"dailyTimes":[5,10,15],"shareUsageData":null,"soundsEnabled":true}""",
                )
            val api =
                object : LearningProfileApi {
                    override suspend fun profile(session: AuthenticatedSession) = profile

                    override suspend fun update(
                        session: AuthenticatedSession,
                        change: JsonObject,
                    ): LearningProfile {
                        changes += change
                        return profile
                    }
                }
            val learning = LearningProfileStore(api, AppCache(sessions, backgroundScope))
            val switching = GoalSwitch(ready = sessions::restore, makeActive = learning::setActiveGoal)
            val restoring = async { sessions.restore() }
            runCurrent()
            val tappedGoal = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d11")

            // MainActivity.openReminder immediately dispatches this while AppContainer.restore is pending.
            val tap = async { switching.select(tappedGoal, emptyList()) { false } }
            runCurrent()
            loaded.complete(Unit)
            restoring.await()
            tap.await()
            advanceUntilIdle()

            assertEquals("Notification goal was dropped during credential restoration", 1, changes.size)
        }
}
