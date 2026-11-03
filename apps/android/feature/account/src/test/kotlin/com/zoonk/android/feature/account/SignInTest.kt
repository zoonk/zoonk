package com.zoonk.android.feature.account

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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
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
    fun anEmailCodeSignsInOnceItsSixDigitsAreTyped() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())

            signIn.onEmailChange("  Ana@Zoonk.test ")
            signIn.sendCode()
            advanceUntilIdle()
            assertEquals(listOf("ana@zoonk.test"), api.codesSent)
            assertEquals("ana@zoonk.test", signIn.codeSentTo)

            signIn.onCodeChange("12 34 5")
            advanceUntilIdle()
            assertTrue(sessions.state.value is SessionState.SignedOut)

            signIn.onCodeChange("123456")
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
    fun aWrongCodeCanBeRetypedButAnExpiredOneNeedsANewCode() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())
            signIn.onEmailChange("ana@zoonk.test")
            signIn.sendCode()
            advanceUntilIdle()

            api.codeFailure = ApiException(ApiError.Unavailable, "EMAIL_SIGN_IN_CODE_INVALID")
            signIn.onCodeChange("111111")
            advanceUntilIdle()
            assertEquals(AccountFailure.WrongCode, signIn.failure)
            assertFalse(signIn.needsNewCode)

            api.codeFailure = ApiException(ApiError.Unavailable, "EMAIL_SIGN_IN_CODE_EXPIRED")
            signIn.onCodeChange("222222")
            advanceUntilIdle()
            assertTrue(signIn.needsNewCode)

            signIn.onCodeChange("333333")
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
    fun aProfileBeingSavedCantBeEdited() =
        runTest {
            val (sessions, account) = stores()
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            val form = ProfileFormViewModel(account, (sessions.state.value as SessionState.SignedIn).account.user, SavedStateHandle())
            advanceUntilIdle()

            form.onNameChange("Bia")
            form.save()
            form.onUsernameChange("someone_else")
            form.onNameChange("Other")
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
            advanceUntilIdle()
            assertEquals("ana_learner", form.username)
            assertEquals(UsernameStatus.Available, form.usernameStatus)

            api.takenUsernames = setOf("bia")
            form.onUsernameChange(" Bia ")
            assertEquals(UsernameStatus.Checking, form.usernameStatus)
            assertFalse(form.canSave)
            advanceTimeBy(301)
            assertEquals(UsernameStatus.Taken, form.usernameStatus)

            form.onUsernameChange("bia_2")
            form.onNameChange("Bia")
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
            advanceUntilIdle()

            form.onNameChange("${longName}b")
            assertTrue(form.isNameTooLong)
            assertFalse(form.canSave)

            form.onNameChange(longName)
            form.onUsernameChange("bia_2")
            advanceUntilIdle()
            assertFalse(form.isNameTooLong)
            form.save()
            advanceUntilIdle()

            assertEquals(listOf(null to "bia_2"), api.saved)
            assertTrue(form.isSaved)
        }
}
