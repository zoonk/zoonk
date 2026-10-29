package com.zoonk.android.feature.account

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.BIA
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.GUEST
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.account
import com.zoonk.api.models.AccountDataExport
import com.zoonk.api.models.MeResponse
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

internal class FakeAccountApi : AccountApi {
    val codesSent = mutableListOf<String>()
    val signInBearers = mutableListOf<String?>()
    var sendFailure: ApiException? = null
    var codeFailure: ApiException? = null
    var takenUsernames = setOf<String>()
    var saveFailure: ApiException? = null
    var suggestion: String? = "ana_learner"
    val saved = mutableListOf<Pair<String, String>>()
    val deletionCodesSent = mutableListOf<String>()
    val deletions = mutableListOf<String?>()
    var deletionFailures = mutableListOf<ApiException>()
    var appleAuthorizationRevoked: Boolean? = null

    override suspend fun sendEmailCode(email: String) {
        sendFailure?.let { throw it }
        codesSent += email
    }

    override suspend fun emailSession(
        email: String,
        code: String,
        current: AuthenticatedSession?,
    ): String {
        codeFailure?.let { throw it }
        signInBearers += current?.bearerToken
        return "token-b"
    }

    override suspend fun guest(): String = "token-guest"

    override suspend fun google(
        idToken: String,
        current: AuthenticatedSession?,
    ): String {
        signInBearers += current?.bearerToken
        return "token-b"
    }

    override suspend fun usernameSuggestion(session: AuthenticatedSession): String? = suggestion

    override suspend fun isUsernameAvailable(username: String): Boolean = username !in takenUsernames

    override suspend fun updateProfile(
        session: AuthenticatedSession,
        name: String,
        username: String,
    ): MeResponse {
        saveFailure?.let { throw it }
        saved += name to username
        return account(session.accountId).let { it.copy(user = it.user.copy(name = name, username = username)) }
    }

    override suspend fun exportData(session: AuthenticatedSession): AccountDataExport = throw ApiException(ApiError.Unavailable)

    override suspend fun sendDeletionCode(
        session: AuthenticatedSession,
        email: String,
    ) {
        deletionCodesSent += email
    }

    override suspend fun deleteAccount(
        session: AuthenticatedSession,
        emailCode: String?,
        email: String,
    ): Boolean? {
        deletionFailures.removeFirstOrNull()?.let { throw it }
        deletions += emailCode
        return appleAuthorizationRevoked
    }
}

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
    fun anInvalidEmailIsCaughtBeforeSending() =
        runTest {
            val (sessions, account) = stores()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())

            signIn.onEmailChange("ana@zoonk")
            signIn.sendCode()
            advanceUntilIdle()

            assertEquals(AccountFailure.InvalidEmail, signIn.failure)
            assertTrue(api.codesSent.isEmpty())
            assertNull(signIn.codeSentTo)
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
    fun aRateLimitedResendSaysToWait() =
        runTest {
            val (sessions, account) = stores()
            val signIn = SignInViewModel(account, sessions, SavedStateHandle())
            signIn.onEmailChange("ana@zoonk.test")
            signIn.sendCode()
            advanceUntilIdle()

            api.sendFailure = ApiException(ApiError.Unavailable, "RATE_LIMIT_EXCEEDED")
            signIn.resendCode()
            advanceUntilIdle()

            assertEquals(ResendStatus.RateLimited, signIn.resend)
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
}
