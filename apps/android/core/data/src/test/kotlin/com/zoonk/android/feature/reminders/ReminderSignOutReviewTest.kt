package com.zoonk.android.feature.reminders

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignOutResult
import com.zoonk.android.data.StoredSession
import com.zoonk.api.models.PushPlatform
import com.zoonk.api.models.StudyReminder
import com.zoonk.api.models.StudyReminderEmail
import com.zoonk.api.models.StudyReminderOfferClaim
import com.zoonk.api.models.StudyReminderPhone
import com.zoonk.api.models.StudyReminderPush
import com.zoonk.api.models.StudyReminderPushPhone
import com.zoonk.api.models.StudyReminderUpdate
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

private val signOutLearner = AuthenticatedSession(ANA, "token-a", "local-a")

private class SignOutReviewApi(
    initialToken: String,
) : StudyReminderApi {
    var saved =
        StudyReminder(
            email = StudyReminderEmail(address = "ana@zoonk.test", on = false),
            push = StudyReminderPush(on = true, phone = StudyReminderPushPhone("Old phone", PushPlatform.ANDROID, initialToken)),
            quiet = false,
            time = "19:00",
            timeZone = "America/Sao_Paulo",
        )
    val response = CompletableDeferred<Unit>()
    val calls = mutableListOf<String>()

    override suspend fun reminder(session: AuthenticatedSession) = saved

    override suspend fun update(
        session: AuthenticatedSession,
        update: StudyReminderUpdate,
    ): StudyReminder = error("Not used")

    override suspend fun claimOffer(
        session: AuthenticatedSession,
        claim: StudyReminderOfferClaim,
    ) = true

    override suspend fun selectPhone(
        session: AuthenticatedSession,
        phone: StudyReminderPhone,
    ): StudyReminder {
        calls += "PUT ${phone.token} committed"
        saved = saved.copy(push = saved.push.copy(phone = StudyReminderPushPhone(phone.label, phone.platform, phone.token)))
        val reply = saved
        // The server has committed the PUT, but its response has not reached Android yet.
        response.await()
        return reply
    }

    override suspend fun removePhone(
        session: AuthenticatedSession,
        token: String,
    ): StudyReminder {
        calls += "DELETE $token"
        // clearStudyReminderPhone conditionally clears only the token named in the DELETE.
        if (saved.push.phone?.token == token) saved = saved.copy(push = StudyReminderPush(on = false, phone = null))
        return saved
    }
}

private class SignOutReviewPush(
    override var token: String?,
) : PushAddress {
    override val label = "This phone"

    override suspend fun register() = "fid-new"

    override suspend fun save(token: String) {
        this.token = token
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class ReminderSignOutReviewTest {
    @get:Rule
    val folder = TemporaryFolder()

    @Test
    fun signOutDuringUseThisDeviceMustRemoveThePhoneTheServerAccepted() = signOutDuringPhoneWrite(refresh = false)

    @Test
    fun signOutDuringTokenRefreshMustRemoveThePhoneTheServerAccepted() = signOutDuringPhoneWrite(refresh = true)

    @Test
    fun signOutAfterLostRefreshResponseMustRemoveThePhoneTheServerAccepted() = signOutDuringPhoneWrite(refresh = true, responseLost = true)

    private fun signOutDuringPhoneWrite(
        refresh: Boolean,
        responseLost: Boolean = false,
    ) = runTest {
        val api = SignOutReviewApi(if (refresh) "fid-old" else "fid-other-device")
        val push = SignOutReviewPush(if (refresh) "fid-old" else null)
        val sessionApi = FakeSessionApi().apply { accounts["token-a"] = ANA }
        lateinit var reminders: StudyReminderStore
        val sessions =
            SessionStore(
                sessionApi,
                MemoryCredentials(StoredSession(signOutLearner)),
                DraftStore(folder.root, backgroundScope, io = StandardTestDispatcher(testScheduler)),
                onChange = { _, _ -> },
                clearCredentialState = {},
                leaving = { reminders.leave(it) },
            )
        sessions.restore()
        reminders = StudyReminderStore(api, AppCache(sessions, backgroundScope), push, sessions) { "en" }
        val writing =
            async {
                if (refresh) reminders.follow("fid-new") else reminders.useThisPhone()
            }
        runCurrent()
        assertEquals(
            "fid-new",
            api.saved.push.phone
                ?.token,
        )
        if (responseLost) {
            api.response.completeExceptionally(ApiException(ApiError.Network))
            writing.await()
        }
        // Sign-out waits for a phone write under way, so its answer arrives while sign-out is pending.
        val signingOut = async { sessions.signOut() }
        runCurrent()
        if (!responseLost) {
            api.response.complete(Unit)
            writing.await()
        }
        assertEquals(SignOutResult.SignedOut, signingOut.await())
        assertNull(sessions.current)
        assertEquals(listOf("token-a"), sessionApi.revoked)

        assertNull("Signed out, but push is still ${api.saved.push}; requests: ${api.calls}", api.saved.push.phone)
    }
}
