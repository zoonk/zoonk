package com.zoonk.android.feature.mock

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.GateWords

@Composable
fun MockPreparingNote() {
    GateWords(title = stringResource(R.string.mock_preparing_title), line = stringResource(R.string.mock_preparing_line))
}
