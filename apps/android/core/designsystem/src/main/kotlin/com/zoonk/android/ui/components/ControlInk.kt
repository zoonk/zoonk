package com.zoonk.android.ui.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.offset

/**
 * Material's radio button and checkbox draw their ink 2dp inside their box (`RadioButtonPadding`,
 * `CheckboxDefaultPadding`). At a row's end the box takes only the ink's room, so the ink, which a learner
 * sees, ends on the row's end edge as a chevron's does. [vertically] takes only the ink's room down too, for a
 * control that sits on a line of text no taller than its ink.
 */
fun Modifier.controlInk(vertically: Boolean = false): Modifier =
    layout { measurable, constraints ->
        val inset = CONTROL_PADDING.roundToPx()
        val top = if (vertically) inset else 0
        val placeable = measurable.measure(constraints.offset(horizontal = inset * 2, vertical = top * 2))
        layout(constraints.constrainWidth(placeable.width - inset * 2), constraints.constrainHeight(placeable.height - top * 2)) {
            placeable.placeRelative(-inset, -top)
        }
    }

private val CONTROL_PADDING = 2.dp
