package com.zoonk.android.ui.testing

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.view.View
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.ViewRootForTest
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.graphics.createBitmap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

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
    return (view.dialogWindowPicture(this) ?: captureToImage()).withLayout(this, view, scenario, anchors)
}

/**
 * A dialog's own picture, cropped to the node: its window's root drawn on its own. Robolectric's PixelCopy of a dialog's
 * window returns the page behind it at the dialog's bounds, so a dialog render would show the page. A dialog that fills
 * the window measures a pixel taller than it there, so the node is cut to what its window shows.
 */
private fun View.dialogWindowPicture(node: SemanticsNodeInteraction): ImageBitmap? {
    val dialog = generateSequence(this as View?) { it.parent as? View }.firstNotNullOfOrNull { it as? DialogWindowProvider } ?: return null
    val root = dialog.window.decorView
    val window = createBitmap(root.width, root.height)
    root.draw(Canvas(window))
    val shown = node.fetchSemanticsNode().boundsInWindow.intersect(Rect(0f, 0f, root.width.toFloat(), root.height.toFloat()))
    return Bitmap
        .createBitmap(
            window,
            shown.left.roundToInt(),
            shown.top.roundToInt(),
            shown.width.roundToInt(),
            shown.height.roundToInt(),
        ).asImageBitmap()
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
