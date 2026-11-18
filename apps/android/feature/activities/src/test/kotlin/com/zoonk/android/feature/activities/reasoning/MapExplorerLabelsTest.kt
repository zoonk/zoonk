package com.zoonk.android.feature.activities.reasoning

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.GraphicsMode
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf23Value as MapExplorerContent

@GraphicsMode(GraphicsMode.Mode.NATIVE)
@RunWith(AndroidJUnit4::class)
class MapExplorerLabelsTest {
    @get:Rule val rule = createComposeRule()

    @Test fun londonExploreKeepsBroadStreetOnItsLineAt320DpAndTwiceTheTextSize() {
        val explore = (ActivityFixtures.exploreStep("mapExplorer").content as StepContent.Explanation).explore!!
        val content = explore.content as MapExplorerContent
        val map = explore.baseMap!!.toBaseMap()
        val frame = layoutPins(map.drawing, content.value.fields.places, 288.0)
        lateinit var labels: MapLabelsLayout
        rule.setContent {
            CompositionLocalProvider(LocalDensity provides Density(3f, 2f)) {
                ZoonkTheme {
                    labels = mapLabelLayout(map, frame, mapLabelReferences(content.value), "")
                }
            }
        }
        rule.runOnIdle {
            val index = map.drawing.labels.indexOfFirst { it.text == "Broad Street" }
            val spot = labels.spots[index]
            assertNotNull("Broad Street must remain named in the London explore map", spot)
            val wardour = map.drawing.labels.indexOfFirst { it.text == "Wardour Street" }
            assertNotNull("Wardour Street has room beside its path", labels.spots[wardour])
            spot!!
            assertTrue(labels.labels[index].priority)
            val street = labels.labels[index]
            val distance =
                street.positions!!.zipWithNext().minOf { (a, b) ->
                    val dx = b.x - a.x
                    val dy = b.y - a.y
                    val t = ((spot.x - a.x) * dx + (spot.y - a.y) * dy).div(dx * dx + dy * dy).coerceIn(0.0, 1.0)
                    kotlin.math.hypot(spot.x - a.x - t * dx, spot.y - a.y - t * dy)
                }
            assertTrue("Broad Street must be on its own street", distance < 0.01)
            listOf(index, wardour).forEach { labelIndex ->
                val label = labels.labels[labelIndex]
                val placed = labels.spots[labelIndex]!!
                val angle = label.angle * Math.PI / 180
                val halfWidth = label.width * placed.scale / 2 + 1.5
                val halfHeight = label.height * placed.scale / 2 + 1.5
                val rx = halfWidth * abs(cos(angle)) + halfHeight * abs(sin(angle))
                val ry = halfWidth * abs(sin(angle)) + halfHeight * abs(cos(angle))
                assertTrue(placed.x >= rx && placed.x + rx <= frame.width && placed.y >= ry && placed.y + ry <= frame.height)
                labels.pinNumbers.forEach { number ->
                    assertTrue(
                        "Street labels' halos must clear every pin number",
                        placed.x + rx <= number.x || placed.x - rx >= number.x + number.width ||
                            placed.y + ry <= number.y || placed.y - ry >= number.y + number.height,
                    )
                }
            }
        }
    }
}
