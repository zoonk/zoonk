package com.zoonk.android.data

import androidx.datastore.core.Serializer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors

@Serializable
data class EssayDraft(
    val text: String,
)

@OptIn(ExperimentalCoroutinesApi::class)
class DraftStoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val api =
        FakeSessionApi().apply { accounts += mapOf("token-a" to ANA, "token-a2" to ANA, "token-b" to BIA, "guest" to GUEST) }

    private fun TestScope.sessions(drafts: DraftStore) = SessionStore(api, MemoryCredentials(), drafts, { _, _ -> }, {})

    private fun TestScope.drafts() =
        DraftStore(
            folder.root,
            CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)),
            io = StandardTestDispatcher(testScheduler),
        )

    private fun entries(accountId: String): String? = File(folder.root, "$accountId.json").takeIf { it.exists() }?.readText()

    @Test
    fun anEarlierLearnersLateSavesNeverReachTheNextLearner() =
        runTest {
            val drafts = drafts()
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn { "token-a" }
            val ana = sessions.current!!
            val essay = drafts.open(ana, "essay:1", EssayDraft.serializer())
            essay.save(EssayDraft("Ana's first draft"))
            val late = drafts.open(ana, "essay:2", EssayDraft.serializer())

            sessions.signIn { "token-b" }
            val bia = sessions.current!!
            drafts.open(bia, "essay:1", EssayDraft.serializer()).save(EssayDraft("Bia's essay"))
            essay.saveDebounced(EssayDraft("Ana typed more"))
            essay.remove()
            late.save(EssayDraft("Ana's late save"))
            advanceUntilIdle()

            assertNull(entries(ANA))
            assertEquals("""{"entries":{"essay:1":{"text":"Bia's essay"}}}""", entries(BIA))
            assertNull(essay.value.first())
        }

    @Test
    fun signingInAgainToTheSameAccountKeepsAPendingSave() =
        runTest {
            val drafts = drafts()
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn { "token-a" }
            val essay = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())
            essay.saveDebounced(EssayDraft("kept"))
            sessions.signIn { "token-a2" }
            advanceUntilIdle()
            assertEquals("""{"entries":{"essay:1":{"text":"kept"}}}""", entries(ANA))
        }

    @Test
    fun aGuestsPendingSaveMovesWithTheGuestToTheAccount() =
        runTest {
            val drafts = drafts()
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn(asGuest = true) { "guest" }
            val guest = sessions.current!!
            drafts.open(guest, "focus:1", EssayDraft.serializer()).save(EssayDraft("saved"))
            drafts.open(guest, "essay:1", EssayDraft.serializer()).saveDebounced(EssayDraft("pending"))
            advanceTimeBy(100)

            sessions.signIn { current -> "token-a".also { assertEquals(guest, current) } }
            advanceUntilIdle()

            assertNull(entries(GUEST))
            val moved = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())
            assertEquals(EssayDraft("pending"), moved.value.first())
            assertEquals(EssayDraft("saved"), drafts.open(sessions.current!!, "focus:1", EssayDraft.serializer()).value.first())
        }

    @Test
    fun aRegisteredLearnersDraftsNeverMoveToTheNextAccount() =
        runTest {
            val drafts = drafts()
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn { "token-a" }
            drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer()).save(EssayDraft("Ana's"))
            sessions.signIn { "token-b" }
            advanceUntilIdle()
            assertNull(entries(ANA))
            assertNull(drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer()).value.first())
        }

    @Test
    fun aSaveAfterSignOutIsDroppedAndRecreatesNoFile() =
        runTest {
            val drafts = drafts()
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn { "token-a" }
            val essay = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())
            essay.save(EssayDraft("before"))
            sessions.signOut()
            essay.save(EssayDraft("after sign-out"))
            essay.saveDebounced(EssayDraft("debounced after sign-out"))
            advanceUntilIdle()
            assertTrue(
                folder.root
                    .listFiles()
                    .orEmpty()
                    .isEmpty(),
            )
        }

    @Test
    fun twoHandlesOnOneKeySeeTheLastWrite() =
        runTest {
            val drafts = drafts()
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn { "token-a" }
            val first = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())
            val second = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())
            first.saveDebounced(EssayDraft("one"))
            second.saveDebounced(EssayDraft("two"))
            advanceUntilIdle()
            assertEquals(EssayDraft("two"), first.value.first())
            assertEquals(EssayDraft("two"), second.value.first())
            second.flush()
            first.save(EssayDraft("three"))
            assertEquals(EssayDraft("three"), second.value.first())
        }

    @Test
    fun aDraftsWriteLandsWhileItsCallersThreadIsBusy() =
        runTest {
            val io = Executors.newSingleThreadExecutor { Thread(it, "drafts-io") }.asCoroutineDispatcher()
            val caller = Executors.newSingleThreadExecutor { Thread(it, "caller") }
            val busy = CountDownLatch(1)
            val drafts = DraftStore(folder.root, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)), io = io)
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn { "token-a" }
            val essay = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())

            val saving = CoroutineScope(caller.asCoroutineDispatcher()).launch { essay.save(EssayDraft("saved")) }
            caller.execute { busy.await() }
            val landed =
                (1..50).any {
                    Thread.sleep(100)
                    entries(ANA)?.contains("saved") == true
                }
            busy.countDown()
            saving.join()
            caller.shutdown()
            io.close()

            assertTrue(landed)
        }

    @Test
    fun aDraftWritesItsFileOffTheMainThread() =
        runTest {
            val mainThread = Thread.currentThread()
            val io = Executors.newSingleThreadExecutor { Thread(it, "drafts-io") }.asCoroutineDispatcher()
            val fileThreads = mutableSetOf<Thread>()
            val recording =
                object : Serializer<LearnerDrafts> {
                    private val wrapped = DraftStore.LearnerDraftsSerializer
                    override val defaultValue = wrapped.defaultValue

                    override suspend fun readFrom(input: InputStream) =
                        wrapped.readFrom(input).also { fileThreads += Thread.currentThread() }

                    override suspend fun writeTo(
                        t: LearnerDrafts,
                        output: OutputStream,
                    ) {
                        fileThreads += Thread.currentThread()
                        wrapped.writeTo(t, output)
                    }
                }
            val main = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val drafts = DraftStore(folder.root, main, io = io, serializer = recording)
            val sessions = sessions(drafts).apply { restore() }
            sessions.signIn { "token-a" }
            val essay = drafts.open(sessions.current!!, "essay:1", EssayDraft.serializer())
            essay.save(EssayDraft("written on IO"))
            essay.saveDebounced(EssayDraft("debounced on IO"))
            advanceTimeBy(600)
            essay.flush()
            assertEquals(EssayDraft("debounced on IO"), essay.value.first { it?.text == "debounced on IO" })
            sessions.signOut()
            io.close()

            assertTrue(fileThreads.isNotEmpty())
            assertFalse(mainThread in fileThreads)
            assertTrue(Json.parseToJsonElement(entries(ANA) ?: "{}").toString().isNotEmpty())
        }
}
