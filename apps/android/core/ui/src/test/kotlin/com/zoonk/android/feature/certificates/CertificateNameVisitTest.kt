package com.zoonk.android.feature.certificates

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.BIA
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.feature.account.AccountStore
import com.zoonk.android.feature.account.FakeAccountApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/** The certificate's name that didn't save says so only on the visit to the field that asked. */
@OptIn(ExperimentalCoroutinesApi::class)
class CertificateNameVisitTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val api = FakeAccountApi()

    @After
    fun reset() = Dispatchers.resetMain()

    @Test
    fun aNameThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = save(leaveFirst = true)

    @Test
    fun aNameFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = save(leaveFirst = false)

    private fun save(leaveFirst: Boolean) =
        runTest {
            val dispatcher = StandardTestDispatcher(testScheduler)
            Dispatchers.setMain(dispatcher)
            val main = CoroutineScope(SupervisorJob() + dispatcher)
            val sessions =
                SessionStore(
                    FakeSessionApi().apply { accounts += mapOf("token-b" to BIA) },
                    MemoryCredentials(),
                    DraftStore(folder.root, main, io = dispatcher),
                    onChange = { _, _ -> },
                    clearCredentialState = {},
                )
            val account = AccountStore(api, sessions, AppCache(sessions, main))
            sessions.restore()
            account.signInWithEmailCode("bia@zoonk.test", "123456")
            advanceUntilIdle()
            val model = CertificateNameModel(account, SavedStateHandle())
            val held = CompletableDeferred<Unit>().also { api.saveGate = it }
            api.saveFailure = ApiException(ApiError.Network)

            model.change("Ana")
            model.type("Ana Lima")
            model.save("Ana")
            runCurrent()
            if (leaveFirst) model.visit.end()
            held.complete(Unit)
            advanceUntilIdle()
            if (!leaveFirst) {
                assertTrue(model.failed)
                model.visit.end()
            }

            assertFalse(model.failed)
        }
}
