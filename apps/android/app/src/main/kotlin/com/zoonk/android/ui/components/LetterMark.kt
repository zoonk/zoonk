package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit

/** A letter sized as a [share] of its box, so it keeps to the box at any font size, as main's rem-sized marks do. */
@Composable
fun LetterMark(
    letter: String,
    size: Dp,
    share: Float,
    color: Color,
    style: TextStyle,
    modifier: Modifier = Modifier,
) {
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Text(
            text = letter,
            color = color,
            fontSize = with(LocalDensity.current) { (size * share).toSp() },
            style = style.copy(lineHeight = TextUnit.Unspecified),
            maxLines = 1,
        )
    }
}
