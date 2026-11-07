package com.zoonk.android.feature.reminders

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
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
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val ana = AuthenticatedSession("ana", "token-a", "local-a")
private val bia = AuthenticatedSession("bia", "token-b", "local-b")

private fun reminder(
    phone: String? = null,
    pushOn: Boolean = false,
    time: String = "19:00",
) = StudyReminder(
    email = StudyReminderEmail(address = "ana@zoonk.test", on = false),
    push = StudyReminderPush(on = pushOn, phone = phone?.let { StudyReminderPushPhone("Pixel 9", PushPlatform.ANDROID, it) }),
    quiet = false,
    time = time,
    timeZone = "America/Sao_Paulo",
)

private class FakeReminderApi(
    var saved: StudyReminder = reminder(),
) : StudyReminderApi {
    val calls = mutableListOf<String>()
    var refuse: String? = null

    override suspend fun reminder(session: AuthenticatedSession) = saved

    override suspend fun update(
        session: AuthenticatedSession,
        update: StudyReminderUpdate,
    ): StudyReminder {
        calls += "update pushOn=${update.pushOn} emailOn=${update.emailOn} time=${update.time} ${update.locale.value}"
        if (refuse == "update") throw ApiException(ApiError.Unavailable)
        saved = saved.copy(push = saved.push.copy(on = update.pushOn ?: saved.push.on), time = update.time ?: saved.time)
        return saved
    }

    override suspend fun claimOffer(
        session: AuthenticatedSession,
        claim: StudyReminderOfferClaim,
    ) = true

    override suspend fun selectPhone(
        session: AuthenticatedSession,
        phone: StudyReminderPhone,
    ): StudyReminder {
        calls += "select ${phone.token} ${phone.label} ${phone.platform.value} ${phone.locale.value}"
        if (refuse == "select") throw ApiException(ApiError.Network)
        saved = saved.copy(push = saved.push.copy(phone = StudyReminderPushPhone(phone.label, phone.platform, phone.token)))
        return saved
    }

    override suspend fun removePhone(
        session: AuthenticatedSession,
        token: String,
    ): StudyReminder {
        calls += "remove $token"
        return saved
    }
}

private class FakePush(
    override var token: String? = null,
    private val registers: String? = "fid-1",
) : PushAddress {
    override val label = "Pixel 9"
    var registering: CompletableDeferred<Unit>? = null

    override suspend fun register(): String? {
        registering?.await()
        return registers
    }

    override suspend fun save(token: String) {
        this.token = token
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class StudyReminderStoreTest {
    private val api = FakeReminderApi()
    private val sessions = FakeSession(ana)

    private fun TestScope.store(push: PushAddress) =
        StudyReminderStore(
            api,
            AppCache(sessions, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))),
            push,
            sessions,
            language = { "pt" },
        )

    @Test
    fun `remind me selects this phone, then turns push on at the chosen time`() =
        runTest {
            val push = FakePush()
            val store = store(push)

            val result = store.turnOnPush("20:30")

            assertEquals(
                listOf("select fid-1 Pixel 9 android pt", "update pushOn=true emailOn=null time=20:30 pt"),
                api.calls,
            )
            assertTrue(result is MutationResult.Done)
            assertEquals(reminder(phone = "fid-1", pushOn = true, time = "20:30"), store.reminder.state.value.value)
            assertEquals("fid-1", push.token)
        }

    @Test
    fun `push setup writes nothing for a learner who wasn't the one who asked`() =
        runTest {
            val push = FakePush().apply { registering = CompletableDeferred() }
            val store = store(push)

            val setup = async { store.turnOnPush("20:30", learner = store.learner) }
            runCurrent()
            sessions.session = bia
            push.registering?.complete(Unit)

            assertEquals(MutationResult.Obsolete, setup.await())
            assertEquals(emptyList<String>(), api.calls)
            assertNull(push.token)
        }

    @Test
    fun `remind me saves nothing when this phone can't get pushes`() =
        runTest {
            val result = store(FakePush(registers = null)).turnOnPush("20:30")

            assertTrue(result is MutationResult.Failed)
            assertEquals(emptyList<String>(), api.calls)
        }

    @Test
    fun `remind me leaves push off when this phone didn't save`() =
        runTest {
            api.refuse = "select"

            val result = store(FakePush()).turnOnPush("20:30")

            assertTrue(result is MutationResult.Failed)
            assertEquals(listOf("select fid-1 Pixel 9 android pt"), api.calls)
        }

    @Test
    fun `signing out removes this phone only once push was set up on it`() =
        runTest {
            store(FakePush(token = null)).leave(ana)
            assertEquals(emptyList<String>(), api.calls)

            store(FakePush(token = "fid-1")).leave(ana)
            assertEquals(listOf("remove fid-1"), api.calls)
        }

    @Test
    fun `a new token takes over only when the old one was the learner's phone`() =
        runTest {
            api.saved = reminder(phone = "fid-other", pushOn = true)
            store(FakePush(token = "fid-1")).follow("fid-2")
            assertEquals(emptyList<String>(), api.calls)

            api.saved = reminder(phone = "fid-1", pushOn = true)
            store(FakePush(token = "fid-1")).follow("fid-2")
            assertEquals(listOf("select fid-2 Pixel 9 android pt"), api.calls)
        }
}
