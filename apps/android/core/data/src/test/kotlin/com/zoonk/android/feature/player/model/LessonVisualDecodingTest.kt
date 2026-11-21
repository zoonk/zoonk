package com.zoonk.android.feature.player.model

import com.zoonk.android.data.recode
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.LessonVisual.Plot
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlayableLibraryStep
import kotlinx.serialization.json.JsonElement
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Lesson steps, questions and a challenge's decisions read their visual from what the API sends, whichever kind it is. */
class LessonVisualDecodingTest {
    @Test
    fun readsTheChartsAndTimelinesAppsAlreadyGet() {
        assertEquals(
            LessonVisual.Chart(
                chart = LessonVisual.Chart.Kind.Bar,
                title = "Riders per day",
                categoryLabel = "Line",
                valueLabel = "Riders",
                categories = listOf("Red", "Blue"),
                series = listOf(LessonVisual.Chart.Series("2024", listOf(1200.0, 800.0))),
                unit = null,
                axisStart = null,
                source = "City transit",
            ),
            visual(CHART),
        )
        assertEquals(
            LessonVisual.Timeline("Brazil", listOf(LessonVisual.Timeline.Event("1822", "Independence"))),
            visual("""{"kind":"timeline","title":"Brazil","events":[{"date":"1822","label":"Independence","detail":null}]}"""),
        )
    }

    @Test
    fun readsAPlotWithItsNamedPointsAndReferenceLines() {
        assertEquals(
            Plot(
                title = "Bottle fill weight",
                xLabel = "Day",
                yLabel = "Fill weight",
                series =
                    listOf(
                        Plot.Series("Fill weight", Plot.Mark.LineWithPoints, listOf(Plot.Point(1.0, 499.8), Plot.Point(2.0, 503.8, "Spike"))),
                        Plot.Series("Spec", Plot.Mark.Points, listOf(Plot.Point(1.5, 500.0))),
                    ),
                xUnit = null,
                yUnit = "ml",
                references = listOf(Plot.Reference("Upper limit", 503.0), Plot.Reference("Lower limit", 497.0)),
                source = null,
            ),
            visual(PLOT),
        )
    }

    @Test
    fun aKindThisVersionDoesntKnowDrawsNothingInsteadOfFailingItsLesson() {
        val step = step("""{"kind":"explanation","content":{"text":"Rivers run downhill.","visual":{"kind":"map","title":"Rivers","regions":[]}}}""")

        val explanation = (step.content as StepContent.Explanation).content

        assertEquals("Rivers run downhill.", explanation.text)
        assertEquals(LessonVisual.Unknown, explanation.visual?.recode<StepVisual, LessonVisual>())
    }

    @Test
    fun aDecisionCarriesItsChartAndOneWrittenBeforeChartsHasNone() {
        val step = step(challenge(""""visual":$PLOT,"""))
        val older = step(challenge(""))

        val node = (step.content as StepContent.Challenge).content.nodes.single()

        assertEquals("Bottle fill weight", node.visual?.recode<StepVisual, LessonVisual>()?.title)
        assertNull(
            (older.content as StepContent.Challenge)
                .content.nodes
                .single()
                .visual,
        )
    }

    @Test
    fun aVisualWrittenBackReadsTheSame() {
        listOf(visual(CHART), visual(PLOT), LessonVisual.Unknown).forEach { visual ->
            assertEquals(visual, ApiJson.encodeToJsonElement<LessonVisual>(visual).recode<JsonElement, LessonVisual>())
        }
    }

    private fun visual(json: String) = ApiJson.decodeFromString<LessonVisual>(json)

    private fun step(fields: String): LessonStep =
        ApiJson
            .decodeFromString(
                PlayableLibraryStep.serializer(),
                """
                {"id":"00000000-0000-4000-8000-000000000001","position":0,"skillId":null,"citation":null,"image":null,
                 "imagePending":false,"marks":null,"picture":null,"baseMap":null,${fields.trim().removePrefix("{")}
                """.trimIndent(),
            ).toLessonStep()

    private fun challenge(visual: String) =
        """
        {"kind":"challenge","content":{"variant":"work","setting":"Plant floor","title":"Fill line","mission":"Keep it in spec.",
         "team":[{"id":"lead","ai":false,"expertise":"quality","role":"Quality lead"}],"meters":[],"panels":[],
         "skills":[{"id":"read","name":"Reading a control chart","practice":"Look for runs."}],"startNodeId":"n1",
         "nodes":[{"id":"n1",$visual"prompt":"Stop the line?","messages":[{"from":"lead","text":"Day 8 is high."}],
           "choices":[{"id":"stop","text":"Stop it","next":"end","quality":"strong","effects":[],"notes":[],"replies":[]}]}],
         "endings":[{"id":"end","outcome":"Caught early."}]}}
        """
}

private const val CHART =
    """
    {"kind":"chart","chart":"bar","title":"Riders per day","categoryLabel":"Line","valueLabel":"Riders","unit":null,"axisStart":null,
     "categories":["Red","Blue"],"series":[{"name":"2024","values":[1200,800]}],"source":"City transit"}
    """

private const val PLOT =
    """
    {"kind":"plot","title":"Bottle fill weight","xLabel":"Day","xUnit":null,"yLabel":"Fill weight","yUnit":"ml",
     "series":[{"name":"Fill weight","mark":"lineWithPoints","points":[{"x":1,"y":499.8,"label":null},{"x":2,"y":503.8,"label":"Spike"}]},
       {"name":"Spec","mark":"points","points":[{"x":1.5,"y":500,"label":null}]}],
     "references":[{"label":"Upper limit","y":503},{"label":"Lower limit","y":497}],"source":null}
    """
