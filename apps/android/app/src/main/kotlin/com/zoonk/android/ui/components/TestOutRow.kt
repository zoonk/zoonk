package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusMark

enum class TestOutScope { Chapter, Unit }

@Composable
fun TestOutRow(
    scope: TestOutScope,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
    plusRequired: Boolean = false,
) {
    ListRow(
        headline = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.test_out_title))
                if (plusRequired) PlusMark()
            }
        },
        modifier = modifier,
        onClick = onOpen,
        supporting = {
            Text(
                stringResource(
                    when (scope) {
                        TestOutScope.Chapter -> R.string.test_out_skip_chapter
                        TestOutScope.Unit -> R.string.test_out_skip_unit
                    },
                ),
            )
        },
        leading = { KindDot(LearnKind.Practice) },
    )
}
