package com.zoonk.android.feature.player

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class TodayChoicesTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")

    @Test
    fun cantListenLastsTheRestOfTheDayAndEndsAtMidnight() =
        runTest {
            val drafts = DraftStore(folder.root, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)))
            drafts.follow { DraftsChange(ANA) }
            var today = LocalDate.of(2026, 10, 29)
            TodayChoices(drafts) { today }.set(ana, TodayChoice.CantListen, true)

            val nextLesson = TodayChoices(drafts) { today }
            assertTrue(nextLesson.isChosen(ana, TodayChoice.CantListen))
            assertFalse(nextLesson.isChosen(ana, TodayChoice.CantTalk))

            today = today.plusDays(1)
            assertFalse(nextLesson.isChosen(ana, TodayChoice.CantListen))
        }
}
