package com.zoonk.android.ui.scaffold

import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R

@Composable
fun BackButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(painterResource(R.drawable.ic_arrow_back), contentDescription = stringResource(R.string.navigation_back))
    }
}

@Composable
fun CloseButton(
    onClick: () -> Unit,
    label: String? = null,
) {
    IconButton(onClick = onClick) {
        Icon(painterResource(R.drawable.ic_close), contentDescription = label ?: stringResource(R.string.task_leave))
    }
}
