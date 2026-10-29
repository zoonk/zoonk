package com.zoonk.android.ui.components

import com.zoonk.android.data.recode
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ItemSetVisual
import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `@zoonk/utils/plot-scale` and `getCategoryLabels` give. */
class LessonVisualTest {
    @Test
    fun niceDomainsAndTicksMatchMain() {
        val cases =
            listOf(
                Triple(listOf(12.0, 47.0), true, listOf(0.0, 20.0, 40.0, 60.0)),
                Triple(listOf(0.3, 0.71), true, listOf(0.0, 0.2, 0.4, 0.6, 0.8)),
                Triple(listOf(1980.0, 2021.0), false, listOf(1980.0, 2000.0, 2020.0, 2040.0)),
                Triple(listOf(-4.0, 9.0), true, listOf(-5.0, 0.0, 5.0, 10.0)),
                Triple(listOf(5.0, 5.0), true, listOf(0.0, 2.0, 4.0, 6.0)),
                Triple(listOf(103.0, 104.5), false, listOf(103.0, 103.5, 104.0, 104.5)),
            )

        cases.forEach { (values, includeZero, ticks) ->
            assertEquals(ticks, niceTicks(niceDomain(values, includeZero)))
        }
    }

    @Test
    fun categoryLabelsSplitThenSkipWhenTheyDontFit() {
        val width = { label: String -> label.length * 6.6f + 6 }

        assertEquals(CategoryLabels(listOf(listOf("2019"), listOf("2020")), 1), categoryLabels(40f, listOf("2019", "2020"), width))
        assertEquals(
            CategoryLabels(listOf(listOf("Gross", "income"), listOf("Net", "income")), 1),
            categoryLabels(50f, listOf("Gross income", "Net income"), width),
        )
        assertEquals(
            CategoryLabels(listOf(listOf("North America"), listOf("South-East Asia")), 2),
            categoryLabels(60f, listOf("North America", "South-East Asia"), width),
        )
        assertEquals(3, categoryLabels(30f, listOf("Brazilian", "Argentinian", "Chilean"), width).step)
    }

    @Test
    fun readsTheApisChartsAndTimelines() {
        val chart =
            ApiJson.decodeFromString<ItemSetVisual>(
                """{"kind":"chart","chart":"line","title":"Rainfall","categoryLabel":"Month","valueLabel":"mm","unit":null,
                |"axisStart":null,"categories":["Jan","Feb"],"series":[{"name":"2024","values":[12.5,30]}],"source":"INMET"}
                """.trimMargin(),
            )
        val timeline =
            ApiJson.decodeFromString<ItemSetVisual>(
                """{"kind":"timeline","title":"Brazil","events":[{"date":"1822","label":"Independence","detail":null}]}""",
            )

        assertEquals(
            LessonVisual.Chart(
                chart = LessonVisual.Chart.Kind.Line,
                title = "Rainfall",
                categoryLabel = "Month",
                valueLabel = "mm",
                categories = listOf("Jan", "Feb"),
                series = listOf(LessonVisual.Chart.Series("2024", listOf(12.5, 30.0))),
                source = "INMET",
            ),
            chart.recode<ItemSetVisual, LessonVisual>(),
        )
        assertEquals(
            LessonVisual.Timeline("Brazil", listOf(LessonVisual.Timeline.Event("1822", "Independence"))),
            timeline.recode<ItemSetVisual, LessonVisual>(),
        )
    }
}
