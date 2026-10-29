package com.zoonk.android.feature.mindmaps

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.AllowanceResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MindMapRulesTest {
    private val frame = Size(390f, 700f)

    @Test
    fun zoomingKeepsTheSpotUnderTheFingersWhereItWas() {
        assertEquals(PanZoom(2f, -100f, 0f), PanZoom.FIT.zoomAt(frame, Offset(100f, 0f), 2f))
    }

    @Test
    fun zoomNeverGoesPastFittedOrPastTheMostThatHelps() {
        assertEquals(PanZoom.FIT, PanZoom.FIT.zoomAt(frame, Offset.Zero, 0.5f))
        assertEquals(PanZoom.MAX_SCALE, PanZoom.FIT.zoomAt(frame, Offset.Zero, 9f).scale)
    }

    @Test
    fun aZoomedPictureMovesUntilItsEdgeMeetsTheFrames() {
        assertEquals(PanZoom(3f, 390f, -235f), PanZoom(3f).panBy(frame, Offset(1000f, -1000f)))
    }

    @Test
    fun aFittedPictureStaysCentered() {
        assertEquals(PanZoom.FIT, PanZoom.FIT.panBy(frame, Offset(40f, 40f)))
    }

    @Test
    fun zoomingOutPullsThePictureBackOverItsFrame() {
        assertEquals(PanZoom(1.5f, 97.5f, 0f), PanZoom(1.5f, 400f, 0f).clamped(frame))
    }

    @Test
    fun theServersReadyWinsOverWhatThisScreenSaw() {
        val stuck = MindMapLocal(stuck = true)

        assertEquals(MindMapShown.Ready, shownMindMap(MindMapShown.Ready, stuck))
        assertEquals(MindMapShown.Unreachable, shownMindMap(MindMapShown.Generating, stuck))
    }

    @Test
    fun aMapThisScreenSawFinishStaysDrawingUntilTheServersReadSaysSo() {
        assertEquals(MindMapShown.Generating, shownMindMap(MindMapShown.Available, MindMapLocal(shown = MindMapShown.Ready)))
    }

    @Test
    fun withoutARequestTheServerSaysWhereItStands() {
        assertEquals(MindMapShown.Failed, shownMindMap(MindMapShown.Failed, null))
        assertEquals(MindMapShown.Refused, shownMindMap(MindMapShown.Available, MindMapLocal(shown = MindMapShown.Refused)))
    }

    @Test
    fun aPlanWithMapsLeftHasNoCap() {
        assertNull(allowance(remaining = "2").reachedCap(AllowanceItem.Kind.MIND_MAP))
        assertNull(allowance(remaining = "null").reachedCap(AllowanceItem.Kind.MIND_MAP))
    }

    @Test
    fun aCapSaysWhoseItIsAndWhenItComesBack() {
        assertEquals(Limit.Reached(LimitTier.Free, LimitPeriod.Day), allowance(remaining = "0").reachedCap(AllowanceItem.Kind.MIND_MAP))
        assertEquals(
            Limit.Reached(LimitTier.Free, LimitPeriod.Month),
            allowance(remaining = "0", monthly = "5", usedThisMonth = 5).reachedCap(AllowanceItem.Kind.MIND_MAP),
        )
        assertEquals(
            Limit.Reached(LimitTier.Guest, LimitPeriod.Total),
            allowance(remaining = "0", total = "1", usedTotal = 1, tier = "guest").reachedCap(AllowanceItem.Kind.MIND_MAP),
        )
    }

    @Test
    fun aSavedPictureIsNamedForItsChapterInPlainLetters() {
        assertEquals("ondas-e-som.webp", mindMapFileName("Ondas e Som!"))
        assertEquals("funcoes-e-graficos-1.webp", mindMapFileName("Funções e Gráficos 1"))
        assertEquals("mind-map.webp", mindMapFileName("…"))
    }

    @Test
    fun mapsGroupByTheirSubjectInThePlansOrder() {
        val groups = groupBySubject(goalMindMaps().chapters)

        assertEquals(listOf("natural-sciences", "mathematics"), groups.map { it.key })
        assertEquals(listOf("Natural sciences", "Mathematics"), groups.map { it.name })
        assertEquals(4, groups.first().maps.size)
    }

    private fun allowance(
        remaining: String,
        monthly: String = "null",
        usedThisMonth: Int = 0,
        total: String = "null",
        usedTotal: Int = 0,
        tier: String = "free",
    ): AllowanceResponse =
        ApiJson.decodeFromString(
            """
            {"activeGoals":{"limit":1,"used":1},"callTime":{"limitSeconds":null,"monthLimitSeconds":null,"usedSeconds":0,"usedSecondsThisMonth":0},
             "examPrep":{"includesMockExams":false,"studyDays":null},"generatedLessons":null,
             "items":[{"dailyLimit":1,"fairUseDailyLimit":null,"kind":"mindMap","monthlyLimit":$monthly,"remaining":$remaining,
               "totalLimit":$total,"usedThisMonth":$usedThisMonth,"usedToday":1,"usedTotal":$usedTotal}],
             "resets":{"day":"2026-10-30T00:00:00.000Z","month":"2026-11-01T00:00:00.000Z"},"tier":"$tier"}
            """.trimIndent(),
        )
}
