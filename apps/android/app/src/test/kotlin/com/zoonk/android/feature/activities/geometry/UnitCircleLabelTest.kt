package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
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
    private val labelWidth = 70f
    private val labelHeight = 14f

    private fun onCircle(degrees: Double) =
        Offset(center.x + (cos(degrees * PI / 180) * radius).toFloat(), center.y - (sin(degrees * PI / 180) * radius).toFloat())

    private fun box(
        at: Offset,
        anchor: LabelAnchor,
    ): Rect {
        val left =
            when (anchor) {
                LabelAnchor.Start -> at.x
                LabelAnchor.Middle -> at.x - labelWidth / 2
                LabelAnchor.End -> at.x - labelWidth
            }
        return Rect(left, at.y - labelHeight / 2, left + labelWidth, at.y + labelHeight / 2)
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
        val (at, anchor) = sinLabelPlacement(point, center, null, labelWidth, canvasWidth = 311f, unit = 1f)
        val gap = gapToLeg(box(at, anchor), point)

        assertTrue("gap $gap", gap in 3f..32f)
    }

    @Test
    fun putsTheSineValueBesideItsLegWhenItFits() {
        val point = onCircle(30.0)
        val (at, anchor) = sinLabelPlacement(point, center, null, labelWidth, canvasWidth = 800f, unit = 1f)

        assertEquals(LabelAnchor.Start, anchor)
        assertEquals((point.y + center.y) / 2, at.y)
    }

    @Test
    fun clearsTheTargetRingRightAboveThePoint() {
        val point = onCircle(15.0)
        val target = onCircle(30.0)
        val (at, anchor) = sinLabelPlacement(point, center, target, labelWidth, canvasWidth = 311f, unit = 1f)

        assertTrue("label ${box(at, anchor)}, target $target", box(at, anchor).bottom < target.y - 7f)
    }
}
