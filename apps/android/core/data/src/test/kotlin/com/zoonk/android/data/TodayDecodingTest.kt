package com.zoonk.android.data

import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.api.ApiJson
import com.zoonk.api.models.StudyMission
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.Today
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

class TodayDecodingTest {
    @Test
    fun futureDayStateKeepsTheRestOfTodayReadable() {
        val session = fixture("today").getValue("session").jsonObject
        val missions =
            ApiJson.parseToJsonElement(
                """[{"done":0,"kind":"future","status":"todo","total":1},{"done":0,"kind":"review","status":"todo","total":1}]""",
            )
        val future = JsonObject(session + mapOf("state" to JsonPrimitive("future"), "missions" to missions))
        val today = decodeFixture<Today>("today", "session" to future)
        val day = today.session.toDayView()
        assertEquals(StudySession.State.UNKNOWN_DEFAULT_OPEN_API, day.state)
        assertEquals("2026-10-28", day.localDate.toString())
        assertEquals(listOf(StudyMission.Kind.REVIEW), day.missions.map { it.kind })
    }
}
