package com.zoonk.android.ui.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.dp

/**
 * Material's radio button and checkbox draw their ink 2dp inside their box (`RadioButtonPadding`,
 * `CheckboxDefaultPadding`). At a row's end the box takes only the ink's room, so the ink, which a learner
 * sees, ends on the row's end edge as a chevron's does.
 */
fun Modifier.controlInk(): Modifier =
    layout { measurable, constraints ->
        val inset = CONTROL_PADDING.roundToPx()
        val placeable = measurable.measure(constraints)
        layout(placeable.width - inset * 2, placeable.height) { placeable.placeRelative(-inset, 0) }
    }

private val CONTROL_PADDING = 2.dp
