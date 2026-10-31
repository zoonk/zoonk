package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Expected values come from running main's `rhythm-results.ts` and core's `music.ts`. */
class RhythmTest {
    private val expectedMs = listOf(0.0, 500.0, 1000.0, 1500.0)

    private fun results(
        taps: List<Double>,
        tolerance: Int,
        deviceDelayMs: Double? = null,
    ) = Rhythm.results(beatMs = 500.0, deviceDelayMs = deviceDelayMs, expectedMs = expectedMs, tapsMs = taps, toleranceMs = tolerance)

    private fun hit(
        offset: Int?,
        status: TapStatus,
    ) = HitResult(offset, status)

    @Test
    fun theDevicesSteadyDelayIsTakenOutBeforeEachTapIsJudged() {
        assertEquals(
            RhythmResults(
                0,
                listOf(hit(0, TapStatus.OnTime), hit(-10, TapStatus.OnTime), hit(20, TapStatus.OnTime), hit(0, TapStatus.OnTime)),
            ),
            results(listOf(150.0, 640.0, 1170.0, 1650.0), tolerance = 60),
        )
    }

    @Test
    fun earlyLateAndMissedHitsAreNamedAndExtraTapsCounted() {
        assertEquals(
            RhythmResults(
                1,
                listOf(hit(0, TapStatus.OnTime), hit(-80, TapStatus.Early), hit(100, TapStatus.Late), hit(0, TapStatus.OnTime)),
            ),
            results(listOf(0.0, 420.0, 1100.0, 1500.0, 1520.0), tolerance = 50),
        )
        assertEquals(
            RhythmResults(
                0,
                listOf(hit(0, TapStatus.OnTime), hit(0, TapStatus.OnTime), hit(null, TapStatus.Missed), hit(null, TapStatus.Missed)),
            ),
            results(listOf(0.0, 500.0), tolerance = 50),
        )
    }

    @Test
    fun aMeasuredDelayIsTakenOutAndOnlyASmallShiftIsForgiven() {
        assertEquals(
            RhythmResults(
                0,
                listOf(hit(10, TapStatus.OnTime), hit(-20, TapStatus.OnTime), hit(70, TapStatus.Late), hit(-10, TapStatus.OnTime)),
            ),
            results(listOf(130.0, 600.0, 1190.0, 1610.0), tolerance = 50, deviceDelayMs = 120.0),
        )
        assertEquals(
            RhythmResults(0, List(4) { hit(40, TapStatus.OnTime) }),
            results(listOf(100.0, 600.0, 1100.0, 1600.0), tolerance = 50, deviceDelayMs = 0.0),
        )
    }

    @Test
    fun theWorstHitIsAMissFirstThenTheFurthestOff() {
        assertEquals(1, Rhythm.worstHit(listOf(hit(-80, TapStatus.Early), hit(120, TapStatus.Late)))?.index)
        assertEquals(1, Rhythm.worstHit(listOf(hit(120, TapStatus.Late), hit(null, TapStatus.Missed)))?.index)
        assertNull(Rhythm.worstHit(listOf(hit(5, TapStatus.OnTime))))
    }

    @Test
    fun theDevicesDelayIsTheMedianTapAfterEachClickWithinLimits() {
        val clicks = listOf(1000.0, 2000.0, 3000.0, 4000.0, 5000.0, 6000.0)

        assertEquals(105, Rhythm.estimateDeviceDelay(clicks, 1000.0, listOf(1110.0, 2090.0, 3130.0, 4100.0, 5120.0, 6095.0)))
        assertNull(Rhythm.estimateDeviceDelay(clicks, 1000.0, listOf(1110.0, 2090.0, 3130.0)))
        assertEquals(450, Rhythm.estimateDeviceDelay(clicks, 1000.0, clicks.map { it + 450 }))
        assertNull(Rhythm.estimateDeviceDelay(clicks, 1000.0, listOf(880.0, 1890.0, 2880.0, 3890.0, 4880.0)))
    }

    private val sonClave = RhythmFields("x..x..x...x.x...", rounds = 2, stepsPerBeat = 4, tempo = 90, toleranceMs = 100)

    @Test
    fun tapTimesFollowThePatternEveryRound() {
        assertEquals(
            listOf(0.0, 500.0, 1000.0, 1666.67, 2000.0, 2666.67, 3166.67, 3666.67, 4333.33, 4666.67),
            sonClave.tapTimes.map { Math.round(it * 100) / 100.0 },
        )
    }

    @Test
    fun tappingCountsInABarThenClicksEveryBeatOfEveryRound() {
        val schedule = RhythmSchedule(sonClave, RhythmKind.Tap, start = 10.0)
        val beat = 60.0 / 90

        assertEquals(10.0 + 4 * beat, schedule.roundsStart, 1e-9)
        assertEquals(12, schedule.clicks.size)
        assertEquals(listOf(0, 4, 8), schedule.clicks.indices.filter { schedule.clicks[it].kind == MusicClick.Accent })
        assertEquals(schedule.roundsStart + 8 * beat, schedule.end, 1e-9)
        assertEquals(500.0, schedule.tapMs(schedule.roundsStart + 0.5) ?: 0.0, 1e-6)
        assertNull(schedule.tapMs(schedule.roundsStart - beat))
        assertEquals(RhythmPosition(1, 3), schedule.position(schedule.roundsStart + 4 * beat + 3.5 * beat / 4))
        assertNull(schedule.position(schedule.roundsStart - 0.1))
    }

    @Test
    fun listeningPlaysOneRoundWithItsHits() {
        val schedule = RhythmSchedule(sonClave, RhythmKind.Listen, start = 10.0)

        assertEquals(10.0, schedule.roundsStart, 1e-9)
        assertEquals(4, schedule.clicks.count { it.kind != MusicClick.Hit })
        assertEquals(
            sonClave.hitSteps.map { 10.0 + it * 60.0 / 90 / 4 },
            schedule.clicks.filter { it.kind == MusicClick.Hit }.map { it.heardAt },
        )
    }

    @Test
    fun theSoundCheckCountsInThenAsksForATapOnEachClick() {
        val check = SoundCheckSchedule(start = 10.0)

        assertEquals(9, check.clicks.size)
        assertEquals(MusicClick.Accent, check.clicks[3].kind)
        assertEquals(listOf(13000.0, 14000.0, 15000.0, 16000.0, 17000.0, 18000.0), check.clicksMs)
        assertNull(check.click(12.5))
        assertEquals(2, check.click(14.2))
        assertEquals(6, check.click(18.9))
    }
}
