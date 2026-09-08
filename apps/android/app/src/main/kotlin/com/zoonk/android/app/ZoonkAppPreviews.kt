package com.zoonk.android.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.zoonk.android.ui.theme.ZoonkTheme

@Preview(
    name = "Compact phone",
    device = "spec:width=411dp,height=891dp,dpi=420",
    showSystemUi = true,
)
@Preview(
    name = "Expanded tablet",
    device = "spec:width=1280dp,height=800dp,dpi=240",
    showSystemUi = true,
)
@Preview(
    name = "Foldable window",
    device = "spec:width=673dp,height=841dp,dpi=420",
    showSystemUi = true,
)
@Preview(
    name = "Large French text",
    device = "spec:width=411dp,height=891dp,dpi=420",
    fontScale = 2f,
    locale = "fr",
    showSystemUi = true,
)
@Composable
private fun ZoonkAppPreview() {
    ZoonkTheme(dynamicColor = false) {
        ZoonkApp()
    }
}
