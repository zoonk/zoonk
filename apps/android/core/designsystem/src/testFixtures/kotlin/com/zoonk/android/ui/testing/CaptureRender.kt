package com.zoonk.android.ui.testing

import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.captureToImage

fun SemanticsNodeInteraction.captureRender(): ImageBitmap {
    val view = (fetchSemanticsNode().root as ViewRootForTest).view
    // Compose skips its pre-capture redraw on Robolectric, but SDK 37 PixelCopy reads the existing window surface.
    // https://android.googlesource.com/platform/frameworks/support/+/bcef06da086866f7389fdb8e8d5a80cff2ea2808
    view.postInvalidate()
    return captureToImage()
}
