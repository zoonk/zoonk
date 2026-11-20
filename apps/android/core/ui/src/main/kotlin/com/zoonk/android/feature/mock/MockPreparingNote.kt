package com.zoonk.android.feature.mock

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.GateWords

/** Over the bar of a mock still being written, where Start would be: the bar's action is Keep studying until it's ready. */
@Composable
fun MockPreparingNote() {
    GateWords(title = stringResource(R.string.mock_preparing_title), line = stringResource(R.string.mock_preparing_line))
}
