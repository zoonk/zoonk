package com.zoonk.android.feature.buddy

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class EarlierQuestionsStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")
    private val session = FakeSession(ana)
    private val api = FakeEarlierQuestionsApi()

    private fun TestScope.store() =
        EarlierQuestionsStore(api, AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))), session)

    private fun EarlierQuestionsStore.shown() =
        questions.state.value.value
            ?.questions
            ?.map { it.question }

    @Test
    fun olderQuestionsFollowTheNewestUntilTheLast() =
        runTest {
            val store = store()
            store.questions.load()

            assertTrue(store.loadOlder())
            assertEquals((1..4).map { "Question $it" }, store.shown())
            assertNull(
                store.questions.state.value.value
                    ?.nextCursor,
            )

            assertTrue(store.loadOlder())
            assertEquals(listOf("ana" to null, "ana" to UUID(0, 2)), api.reads)
        }

    @Test
    fun aPageThatFailsKeepsTheListAndSaysSo() =
        runTest {
            val store = store()
            store.questions.load()
            api.olderFailure = ApiException(ApiError.Network)

            assertFalse(store.loadOlder())
            assertEquals(listOf("Question 1", "Question 2"), store.shown())
            assertTrue(session.expired.isEmpty())
        }

    @Test
    fun aRefusedSessionSignsOut() =
        runTest {
            val store = store()
            store.questions.load()
            api.olderFailure = ApiException(ApiError.Unauthorized)

            assertFalse(store.loadOlder())
            assertEquals(listOf(ana), session.expired)
        }

    @Test
    fun aPageReadWhileTheListWasRefreshedIsDropped() =
        runTest {
            val store = store()
            store.questions.load()
            val gate = CompletableDeferred<Unit>()
            api.olderGate = gate

            val older = async { store.loadOlder() }
            runCurrent()
            store.questions.refresh()
            gate.complete(Unit)

            assertTrue(older.await())
            assertEquals(listOf("Question 1", "Question 2"), store.shown())
        }

    @Test
    fun aPageReadForAnotherLearnerIsDropped() =
        runTest {
            val store = store()
            store.questions.load()
            val gate = CompletableDeferred<Unit>()
            api.olderGate = gate

            val older = async { store.loadOlder() }
            runCurrent()
            session.session = bia
            gate.complete(Unit)

            older.await()
            assertEquals(listOf("Question 1", "Question 2"), store.shown())
        }
}
