package com.zoonk.android.feature.account

import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.snapshots.Snapshot
import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.BIA
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.GUEST
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.account
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class SignInTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val sessionApi = FakeSessionApi().apply { accounts += mapOf("token-a" to ANA, "token-b" to BIA, "token-guest" to GUEST) }
    private val api = FakeAccountApi()

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.stores(): Pair<SessionStore, AccountStore> {
        val dispatcher = StandardTestDispatcher(testScheduler)
        Dispatchers.setMain(dispatcher)
        val main = CoroutineScope(SupervisorJob() + dispatcher)
        val drafts = DraftStore(folder.root, main, io = dispatcher)
        val sessions = SessionStore(sessionApi, MemoryCredentials(), drafts, onChange = { _, _ -> }, clearCredentialState = {})
        return sessions to AccountStore(api, sessions, AppCache(sessions, main))
    }

    @Test
    fun continuingAnEmptySetupStaysAvailableSoItCanExplainWhatsMissing() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val form = ProfileFormViewModel(account, (sessions.state.value as SessionState.SignedIn).account.user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            form.nameField.setTextAndPlaceCursorAtEnd("")
            Snapshot.sendApplyNotifications()
            runCurrent()
            form.usernameField.setTextAndPlaceCursorAtEnd("")
            Snapshot.sendApplyNotifications()
            runCurrent()
            assertTrue(form.canContinue)
            assertFalse(form.canSave)
            form.continueSetup()
            assertTrue(form.showNameRequired)
            assertTrue(form.showUsernameRequired)
            assertFalse(form.isSaving)
            form.nameField.setTextAndPlaceCursorAtEnd("Bia")
            Snapshot.sendApplyNotifications()
            runCurrent()
            assertFalse(form.showNameRequired)
        }

    @Test
    fun anEmailCodeSignsInOnceItsSixDigitsAreTyped() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())

            signIn.observeCode()
            signIn.emailField.setTextAndPlaceCursorAtEnd("  Ana@Zoonk.test ")
            signIn.sendCode()
            advanceUntilIdle()
            assertEquals(listOf("ana@zoonk.test"), api.codesSent)
            assertEquals("ana@zoonk.test", signIn.codeSentTo)

            signIn.codeField.setTextAndPlaceCursorAtEnd("12345")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertTrue(sessions.state.value is SessionState.SignedOut)

            signIn.codeField.setTextAndPlaceCursorAtEnd("123456")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            val state = sessions.state.value as SessionState.SignedIn
            assertEquals(BIA, state.session.accountId)
            assertEquals(listOf<String?>(null), api.signInBearers)
        }

    @Test
    fun aGuestSigningInSendsItsBearerSoItsPlanMoves() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            assertEquals(SignInResult.SignedIn, account.startAsGuest())
            assertTrue((sessions.state.value as SessionState.SignedIn).isGuest)

            val signIn = SignInViewModel(account, sessions, SavedStateHandle())
            signIn.startGoogle()
            signIn.finishGoogle(GoogleIdToken.Received("google-id-token"))
            advanceUntilIdle()

            assertEquals(listOf<String?>("token-guest"), api.signInBearers)
            val state = sessions.state.value as SessionState.SignedIn
            assertEquals(BIA, state.session.accountId)
            assertFalse(state.isGuest)
        }

    @Test
    fun aRejectedCodeIsntSentAgainUntilItChanges() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())
            signIn.observeCode()
            signIn.emailField.setTextAndPlaceCursorAtEnd("ana@zoonk.test")
            signIn.sendCode()
            advanceUntilIdle()

            api.codeFailure = ApiException(ApiError.Unavailable, "EMAIL_SIGN_IN_CODE_INVALID")
            signIn.codeField.setTextAndPlaceCursorAtEnd("111111")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertEquals(AccountFailure.WrongCode, signIn.failure)

            api.codeFailure = null
            signIn.checkCode()
            advanceUntilIdle()
            assertTrue(api.signInBearers.isEmpty())

            signIn.codeField.setTextAndPlaceCursorAtEnd("111111")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertTrue(api.signInBearers.isEmpty())
            assertTrue(signIn.isCodeRejected)
            assertEquals(AccountFailure.WrongCode, signIn.failure)

            signIn.resendCode()
            advanceUntilIdle()
            Snapshot.sendApplyNotifications()
            runCurrent()
            signIn.codeField.setTextAndPlaceCursorAtEnd("111111")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertEquals(listOf<String?>(null), api.signInBearers)
        }

    @Test
    fun editingARejectedCodeChecksItAgainWhenComplete() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())
            signIn.observeCode()
            signIn.emailField.setTextAndPlaceCursorAtEnd("ana@zoonk.test")
            signIn.sendCode()
            advanceUntilIdle()

            api.codeFailure = ApiException(ApiError.Unavailable, "EMAIL_SIGN_IN_CODE_INVALID")
            signIn.codeField.setTextAndPlaceCursorAtEnd("111111")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertEquals(AccountFailure.WrongCode, signIn.failure)

            api.codeFailure = null
            signIn.codeField.setTextAndPlaceCursorAtEnd("11111")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertFalse(signIn.isCodeRejected)
            assertNull(signIn.failure)
            assertTrue(api.signInBearers.isEmpty())

            signIn.codeField.setTextAndPlaceCursorAtEnd("111112")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertEquals(listOf<String?>(null), api.signInBearers)
            assertTrue(sessions.state.value is SessionState.SignedIn)
        }

    @Test
    fun aCodeRejectedAfterLeavingIsNotAnErrorOnTheNextVisit() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())
            signIn.emailField.setTextAndPlaceCursorAtEnd("ana@zoonk.test")
            signIn.sendCode()
            advanceUntilIdle()
            signIn.observeCode()
            val reply = CompletableDeferred<Unit>().also { api.codeGate = it }
            api.codeFailure = ApiException(ApiError.Unavailable, "EMAIL_SIGN_IN_CODE_INVALID")
            signIn.codeField.setTextAndPlaceCursorAtEnd("111111")
            Snapshot.sendApplyNotifications()
            runCurrent()
            assertEquals(SignInWork.CheckCode, signIn.work)

            signIn.codeVisit.end()
            signIn.observeCode()
            reply.complete(Unit)
            advanceUntilIdle()

            assertNull(signIn.failure)
            assertFalse(signIn.isCodeRejected)
            assertEquals("", signIn.code)
        }

    @Test
    fun anExpiredCodeNeedsANewCode() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())
            signIn.observeCode()
            signIn.emailField.setTextAndPlaceCursorAtEnd("ana@zoonk.test")
            signIn.sendCode()
            advanceUntilIdle()

            api.codeFailure = ApiException(ApiError.Unavailable, "EMAIL_SIGN_IN_CODE_EXPIRED")
            signIn.codeField.setTextAndPlaceCursorAtEnd("222222")
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertTrue(signIn.needsNewCode)

            assertEquals("222222", signIn.code)

            signIn.resendCode()
            advanceUntilIdle()
            assertEquals(ResendStatus.Sent, signIn.resend)
            assertNull(signIn.failure)
            assertEquals("", signIn.code)
        }

    @Test
    fun closingGooglesSheetIsNotAFailure() =
        runTest {
            val (sessions, account) = stores()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())

            signIn.startGoogle()
            signIn.finishGoogle(GoogleIdToken.Canceled)

            assertNull(signIn.work)
            assertNull(signIn.failure)
        }

    @Test
    fun aGoogleAnswerArrivingAfterAnotherSignInChangesNothing() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())

            signIn.startGoogle()
            account.startAsGuest()
            signIn.finishGoogle(GoogleIdToken.Received("google-id-token"))
            advanceUntilIdle()

            assertTrue(api.signInBearers.isEmpty())
            assertTrue((sessions.state.value as SessionState.SignedIn).isGuest)
            assertNull(signIn.work)
        }

    @Test
    fun aProfileSavedWhileThePageIsRecreatedSaysSavedOnce() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val form = ProfileFormViewModel(account, (sessions.state.value as SessionState.SignedIn).account.user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()

            form.nameField.setTextAndPlaceCursorAtEnd("Bia")
            Snapshot.sendApplyNotifications()
            runCurrent()
            form.save()
            advanceUntilIdle()

            assertEquals(Unit, form.saved.value)
            form.saved.acted(Unit)
            assertEquals(null, form.saved.value)
            assertTrue(form.isSaved)
        }

    @Test
    fun aProfileSavedAfterTheLearnerLeftThePageSaysNothingOnReturn() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val form = ProfileFormViewModel(account, (sessions.state.value as SessionState.SignedIn).account.user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()

            form.nameField.setTextAndPlaceCursorAtEnd("Bia")
            Snapshot.sendApplyNotifications()
            runCurrent()
            form.save()
            form.visit.end()
            advanceUntilIdle()

            assertEquals(null, form.saved.value)
            assertEquals(listOf("Bia" to "ana_learner"), api.saved)
        }

    @Test
    fun aProfileThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = profileFailure(leaveFirst = true)

    @Test
    fun aProfileFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = profileFailure(leaveFirst = false)

    private fun profileFailure(leaveFirst: Boolean) =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val form = ProfileFormViewModel(account, (sessions.state.value as SessionState.SignedIn).account.user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            val held = CompletableDeferred<Unit>().also { api.saveGate = it }
            api.saveFailure = ApiException(ApiError.Network)

            form.nameField.setTextAndPlaceCursorAtEnd("Bia")
            Snapshot.sendApplyNotifications()
            runCurrent()
            form.save()
            runCurrent()
            if (leaveFirst) form.visit.end()
            held.complete(Unit)
            advanceUntilIdle()
            if (!leaveFirst) {
                assertEquals(AccountFailure.Network, form.failure)
                form.visit.end()
            }

            assertNull(form.failure)
        }

    @Test
    fun aProfileSaveSendsTheNameAndUsernameFromTheTap() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val form = ProfileFormViewModel(account, (sessions.state.value as SessionState.SignedIn).account.user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()

            form.nameField.setTextAndPlaceCursorAtEnd("Bia")
            Snapshot.sendApplyNotifications()
            runCurrent()
            form.save()
            assertTrue(form.isSaving)
            advanceUntilIdle()

            assertEquals(listOf("Bia" to "ana_learner"), api.saved)
            assertEquals("ana_learner", form.username)
            assertEquals("Bia", form.name)
        }

    @Test
    fun setupSuggestsAUsernameChecksItAndSavesTheProfile() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val user = (sessions.state.value as SessionState.SignedIn).account.user
            assertTrue(user.needsProfileSetup)

            val form = ProfileFormViewModel(account, user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()
            assertEquals("ana_learner", form.username)
            assertEquals(UsernameStatus.Available, form.usernameStatus)

            api.takenUsernames = setOf("bia")
            form.usernameField.setTextAndPlaceCursorAtEnd("bia")
            Snapshot.sendApplyNotifications()
            runCurrent()
            assertEquals(UsernameStatus.Checking, form.usernameStatus)
            assertFalse(form.canSave)
            advanceTimeBy(301)
            assertEquals(UsernameStatus.Taken, form.usernameStatus)

            form.usernameField.setTextAndPlaceCursorAtEnd("bia_2")
            Snapshot.sendApplyNotifications()
            runCurrent()
            form.nameField.setTextAndPlaceCursorAtEnd("Bia")
            Snapshot.sendApplyNotifications()
            runCurrent()
            advanceUntilIdle()
            form.save()
            advanceUntilIdle()

            assertEquals(listOf("Bia" to "bia_2"), api.saved)
            assertFalse((sessions.state.value as SessionState.SignedIn).account.user.needsProfileSetup)
        }

    @Test
    fun aUsernameTakenWhileSavingIsShownAsTaken() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val user = (sessions.state.value as SessionState.SignedIn).account.user
            val form = ProfileFormViewModel(account, user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()

            api.saveFailure = ApiException(ApiError.Unavailable, "CONFLICT")
            form.save()
            advanceUntilIdle()

            assertEquals(AccountFailure.UsernameTaken, form.failure)
            assertEquals(UsernameStatus.Taken, form.usernameStatus)
            assertTrue((sessions.state.value as SessionState.SignedIn).account.user.needsProfileSetup)
        }

    @Test
    fun aChangedNameFitsIn150CodePointsAsTheServerCountsThem() {
        assertFalse(isNameChangeTooLong(" ${"a".repeat(150)} ", savedName = "Learner"))
        assertFalse(isNameChangeTooLong("𠀀".repeat(150), savedName = "Learner"))
        assertTrue(isNameChangeTooLong("a".repeat(151), savedName = "Learner"))
        assertFalse(isNameChangeTooLong(" ${"a".repeat(200)} ", savedName = " ${"a".repeat(200)} "))
    }

    @Test
    fun aNameSavedBeforeTheLimitStaysOutOfASaveThatOnlyChangesTheUsername() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val longName = " ${"a".repeat(151)} "
            val user = (sessions.state.value as SessionState.SignedIn).account.user.copy(name = longName)
            val form = ProfileFormViewModel(account, user, SavedStateHandle())
            runCurrent()
            Snapshot.sendApplyNotifications()
            advanceUntilIdle()

            form.nameField.setTextAndPlaceCursorAtEnd("${longName}b")
            Snapshot.sendApplyNotifications()
            runCurrent()
            assertTrue(form.isNameTooLong)
            assertFalse(form.canSave)

            form.nameField.setTextAndPlaceCursorAtEnd(longName)
            Snapshot.sendApplyNotifications()
            runCurrent()
            form.usernameField.setTextAndPlaceCursorAtEnd("bia_2")
            Snapshot.sendApplyNotifications()
            runCurrent()
            advanceUntilIdle()
            assertFalse(form.isNameTooLong)
            form.save()
            advanceUntilIdle()

            assertEquals(listOf(null to "bia_2"), api.saved)
            assertTrue(form.isSaved)
        }
}
