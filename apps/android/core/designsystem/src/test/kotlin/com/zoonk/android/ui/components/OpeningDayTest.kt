package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class OpeningDayTest {
    private val now = Instant.parse("2026-11-13T22:30:00Z")

    @Test
    fun theDayIsTheLearnersOwnNotUtcs() {
        val at = Instant.parse("2026-11-14T02:00:00Z")
        assertEquals(OpeningDay.Tomorrow, openingDay(at, now, ZoneId.of("UTC")))
        assertEquals(OpeningDay.Today, openingDay(at, now, ZoneId.of("America/Sao_Paulo")))
        assertEquals(OpeningDay.Today, openingDay(at, now, ZoneId.of("Asia/Tokyo")))
    }

    @Test
    fun anInstantAlreadyPastIsOpenNotToday() {
        assertEquals(OpeningDay.Open, openingDay(Instant.parse("2026-11-10T08:00:00Z"), now, ZoneId.of("UTC")))
        assertEquals(OpeningDay.Open, openingDay(now, now, ZoneId.of("UTC")))
        assertEquals(OpeningDay.Today, openingDay(now.plusSeconds(60), now, ZoneId.of("UTC")))
    }

    @Test
    fun aLaterDayIsItsDate() {
        assertEquals(
            OpeningDay.On(LocalDate.of(2026, 11, 22)),
            openingDay(Instant.parse("2026-11-22T09:15:00Z"), now, ZoneId.of("UTC")),
        )
    }
}
