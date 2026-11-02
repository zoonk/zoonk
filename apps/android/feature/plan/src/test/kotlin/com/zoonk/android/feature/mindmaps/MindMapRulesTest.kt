package com.zoonk.android.feature.mindmaps

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import org.junit.Assert.assertEquals
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
    fun aSavedPictureIsNamedForItsChapterInPlainLetters() {
        assertEquals("ondas-e-som.webp", mindMapFileName("Ondas e Som!"))
        assertEquals("funcoes-e-graficos-1.webp", mindMapFileName("Funções e Gráficos 1"))
        assertEquals("mind-map.webp", mindMapFileName("…"))
    }
}
