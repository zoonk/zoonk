package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.ZoonkRadius

@Composable
fun LearnerBubble(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Surface(
        modifier = Modifier.widthIn(max = 480.dp).then(modifier),
        shape =
            RoundedCornerShape(
                topStart = ZoonkRadius.option,
                topEnd = ZoonkRadius.option,
                bottomEnd = 4.dp,
                bottomStart = ZoonkRadius.option,
            ),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
    ) {
        Box(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) { content() }
    }
}
