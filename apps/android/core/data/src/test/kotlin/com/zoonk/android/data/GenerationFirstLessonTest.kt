package com.zoonk.android.data

import com.zoonk.api.models.OnboardingFirstLesson
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

class GenerationFirstLessonTest {
    @Test fun stoppedReadOutranksReplayedWritingAndRecoveryCanBecomeReady() {
        val id = UUID.randomUUID()
        val live = GenerationFirstLesson(id.toString(), "Dawn")
        val stopped = OnboardingFirstLesson(id, OnboardingFirstLesson.Status.STOPPED, "Dawn")
        assertEquals(true, live.withRead(stopped)?.stopped)
        assertEquals(false, live.withRead(stopped)?.ready)
        val ready = stopped.copy(status = OnboardingFirstLesson.Status.READY)
        assertEquals(true, live.withRead(ready)?.ready)
        assertEquals(false, live.withRead(ready)?.stopped)
    }

    @Test fun readinessFromEitherSourceOutranksStoppedAndANewerReadRecoversWriting() {
        val id = UUID.randomUUID()
        val live = GenerationFirstLesson(id.toString(), "Dawn")
        val stopped = OnboardingFirstLesson(id, OnboardingFirstLesson.Status.STOPPED, "Dawn")
        assertEquals(true, live.copy(ready = true).withRead(stopped)?.ready)
        assertEquals(false, live.copy(ready = true).withRead(stopped)?.stopped)
        assertEquals(true, live.copy(done = true).withRead(stopped)?.done)
        val writing = stopped.copy(status = OnboardingFirstLesson.Status.WRITING)
        assertEquals(false, live.withRead(stopped).withRead(writing)?.stopped)
    }

    @Test fun aNewRunResetsThePreviousRunsStoppedRead() {
        val id = UUID.randomUUID()
        val live = GenerationFirstLesson(id.toString(), "Dawn")
        val read = OnboardingFirstLesson(id, OnboardingFirstLesson.Status.STOPPED, "Dawn")
        assertEquals(true, live.withRead(read, "old", "old")?.stopped)
        assertEquals(false, live.withRead(read, "old", "new")?.stopped)
        assertEquals(true, live.withRead(read, "new", "new")?.stopped)
    }
}
