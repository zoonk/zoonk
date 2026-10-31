package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** A 300 dp dial at one pixel per dp: on a phone the canvas is about as wide as the dial. */
class UnitCircleLabelTest {
    private val center = Offset(155f, 150f)
    private val radius = 102f
    private val label = Size(70f, 14f)

    private fun onCircle(degrees: Double) =
        Offset(center.x + (cos(degrees * PI / 180) * radius).toFloat(), center.y - (sin(degrees * PI / 180) * radius).toFloat())

    private fun box(
        at: Offset,
        anchor: LabelAnchor,
        size: Size = label,
    ): Rect {
        val left =
            when (anchor) {
                LabelAnchor.Start -> at.x
                LabelAnchor.Middle -> at.x - size.width / 2
                LabelAnchor.End -> at.x - size.width
            }
        return Rect(Offset(left, at.y - size.height / 2), size)
    }

    private fun gapToLeg(
        label: Rect,
        point: Offset,
    ): Float {
        val leg = Rect(point.x, point.y, point.x, center.y)
        return Offset(maxOf(label.left - leg.right, 0f, leg.left - label.right), maxOf(label.top - leg.bottom, 0f, leg.top - label.bottom))
            .getDistance()
    }

    @Test
    fun keepsTheSineValueByItsLegOnAPhone() {
        val point = onCircle(30.0)
        val (at, anchor) = sinLabelPlacement(point, center, null, label, canvasWidth = 311f, unit = 1f)
        val gap = gapToLeg(box(at, anchor), point)

        assertTrue("gap $gap", gap in 3f..32f)
    }

    @Test
    fun putsTheSineValueBesideItsLegWhenItFits() {
        val point = onCircle(30.0)
        val (at, anchor) = sinLabelPlacement(point, center, null, label, canvasWidth = 800f, unit = 1f)

        assertEquals(LabelAnchor.Start, anchor)
        assertEquals((point.y + center.y) / 2, at.y)
    }

    @Test
    fun clearsTheTargetRingRightAboveThePoint() {
        val point = onCircle(15.0)
        val target = onCircle(30.0)
        val (at, anchor) = sinLabelPlacement(point, center, target, label, canvasWidth = 311f, unit = 1f)

        assertTrue("label ${box(at, anchor)}, target $target", box(at, anchor).bottom < target.y - 7f)
    }

    @Test
    fun keepsTheSineValueClearOfThePointInLargeText() {
        val point = onCircle(30.0)
        val large = Size(140f, 40f)
        val (at, anchor) = sinLabelPlacement(point, center, null, large, canvasWidth = 311f, unit = 1f)
        val label = box(at, anchor, large)
        val nearest = Offset(point.x.coerceIn(label.left, label.right), point.y.coerceIn(label.top, label.bottom))

        assertTrue("label $label, point $point", (nearest - point).getDistance() > FOCUS_RING)
    }

    private companion object {
        const val FOCUS_RING = 17f
    }
}
