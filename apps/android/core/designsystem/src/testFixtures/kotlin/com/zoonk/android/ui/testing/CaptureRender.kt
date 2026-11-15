package com.zoonk.android.ui.testing

import android.os.Build
import android.view.View
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.captureToImage
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The node as it's drawn now. Compose skips its pre-capture redraw on Robolectric, and SDK 37 PixelCopy
 * reads the window surface, which the RenderThread updates on its own after a draw. So this redraws and
 * waits for that frame to be committed, as Compose's redraw does on a device, before copying it.
 * https://android.googlesource.com/platform/frameworks/support/+/bcef06da086866f7389fdb8e8d5a80cff2ea2808
 */
fun SemanticsNodeInteraction.captureRender(
    scenario: String? = null,
    anchors: Map<String, SemanticsMatcher> = emptyMap(),
): ImageBitmap {
    val view = (fetchSemanticsNode().root as ViewRootForTest).view
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || !view.isHardwareAccelerated) {
        view.postInvalidate()
        return captureToImage().withLayout(this, view, scenario, anchors)
    }

    val committed = AtomicBoolean(false)
    view.viewTreeObserver.registerFrameCommitCallback { committed.set(true) }
    view.postInvalidate()
    val deadline = System.nanoTime() + COMMIT_TIMEOUT_NANOS
    while (!committed.get()) {
        check(System.nanoTime() < deadline) { "The frame to capture was never committed" }
        Thread.sleep(1)
        // Waits for the UI to idle, which runs the redraw and the commit callback the RenderThread posts.
        fetchSemanticsNode()
    }
    return captureToImage().withLayout(this, view, scenario, anchors)
}

/** With `-Pzoonk.shots`, the layout of the frame just copied, which [writeRender] writes beside the picture. */
private fun ImageBitmap.withLayout(
    node: SemanticsNodeInteraction,
    view: View,
    scenario: String?,
    anchors: Map<String, SemanticsMatcher>,
): ImageBitmap {
    if (LayoutCapture.enabled) {
        val bitmap = asAndroidBitmap()
        LayoutCapture.remember(bitmap, LayoutCapture.read(node.fetchSemanticsNode(), view, bitmap, scenario, anchors))
    }
    return this
}

private const val COMMIT_TIMEOUT_NANOS = 2_000_000_000L
