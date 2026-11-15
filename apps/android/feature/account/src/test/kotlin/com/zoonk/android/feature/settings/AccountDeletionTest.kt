package com.zoonk.android.feature.settings

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.feature.account.AccountFailure
import com.zoonk.android.feature.account.AccountStore
import com.zoonk.android.feature.account.FakeAccountApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalCoroutinesApi::class)
class AccountDeletionTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val api = FakeAccountApi()
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")

    @After
    fun reset() = Dispatchers.resetMain()

    private suspend fun TestScope.signedIn(): Pair<SessionStore, YourDataViewModel> {
        val dispatcher = StandardTestDispatcher(testScheduler)
        Dispatchers.setMain(dispatcher)
        val main = CoroutineScope(SupervisorJob() + dispatcher)
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += "token-a" to ANA },
                MemoryCredentials(StoredSession(ana)),
                DraftStore(folder.root, main, io = dispatcher),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        sessions.restore()
        advanceUntilIdle()
        return sessions to YourDataViewModel(AccountStore(api, sessions, AppCache(sessions, main)), ana, "ana@zoonk.test") { null }
    }

    @Test
    fun deletingTheAccountEndsTheFlow() =
        runTest {
            val (_, profile) = signedIn()

            profile.askToDelete()
            profile.delete()
            advanceUntilIdle()

            assertEquals(listOf<String?>(null), api.deletions)
            assertEquals(DeletionStep.Deleted, profile.deletionStep)
        }

    @Test
    fun aSessionTooOldToDeleteProvesItsEmailWithACode() =
        runTest {
            val (sessions, profile) = signedIn()
            api.deletionFailures += ApiException(ApiError.Unavailable, "FORBIDDEN", 403)

            profile.askToDelete()
            profile.delete()
            advanceUntilIdle()
            assertEquals(DeletionStep.Code, profile.deletionStep)
            assertEquals(listOf("ana@zoonk.test"), api.deletionCodesSent)

            api.deletionFailures += ApiException(ApiError.Unavailable, "ACCOUNT_DELETION_INVALID_OTP", 400)
            profile.onCodeChange("111111")
            profile.delete()
            advanceUntilIdle()
            assertEquals(AccountFailure.WrongCode, profile.deletionFailure)
            assertTrue(sessions.state.value is SessionState.SignedIn)

            profile.onCodeChange("123456")
            profile.delete()
            advanceUntilIdle()
            assertEquals(listOf<String?>("123456"), api.deletions)
            assertEquals(DeletionStep.Deleted, profile.deletionStep)
        }

    @Test
    fun anAppleAuthorizationLeftInPlaceIsExplainedBeforeLeaving() =
        runTest {
            val (sessions, profile) = signedIn()
            api.appleAuthorizationRevoked = false

            profile.askToDelete()
            profile.delete()
            advanceUntilIdle()
            assertEquals(DeletionStep.AppleNote, profile.deletionStep)
            assertTrue(sessions.state.value is SessionState.SignedIn)

            profile.finish()
            assertEquals(DeletionStep.Deleted, profile.deletionStep)
        }

    @Test
    fun aFailedDeletionKeepsTheAccountAndSaysSo() =
        runTest {
            val (sessions, profile) = signedIn()
            api.deletionFailures += ApiException(ApiError.Unavailable, "INTERNAL_ERROR", 500)

            profile.askToDelete()
            profile.delete()
            advanceUntilIdle()

            assertEquals(AccountFailure.Delete, profile.deletionFailure)
            assertEquals(DeletionStep.Confirm, profile.deletionStep)
            assertTrue(sessions.state.value is SessionState.SignedIn)
        }

    @Test
    fun aDownloadThatFailsWhilePrivacyIsRecreatedStillSaysSo() =
        runTest {
            val (_, data) = signedIn()

            // No page shows while the download is out, as when the window is recreated.
            data.export(PICKED)
            advanceUntilIdle()

            assertTrue(data.exportFailed)
            assertFalse(data.isExporting)
        }

    @Test
    fun aDownloadThatFailsAfterPrivacyLeftSaysNothingOnReturn() =
        runTest {
            val (_, data) = signedIn()

            data.export(PICKED)
            data.visit.end()
            advanceUntilIdle()

            assertFalse(data.exportFailed)
            assertFalse(data.isExporting)
        }

    private companion object {
        val PICKED: Uri = Uri.parse("content://com.android.providers.downloads.documents/document/1")
    }
}
