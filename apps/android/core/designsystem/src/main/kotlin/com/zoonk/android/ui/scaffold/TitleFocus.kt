package com.zoonk.android.ui.scaffold

import android.view.View
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import androidx.compose.foundation.focusable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionOnScreen
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.toSize
import com.zoonk.android.ui.components.rememberMoveFocus
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

/**
 * Whether the shell shows this page or task on top because the learner went to it (opened it or
 * went back to it), as opposed to beside another or under a tab they switched to.
 */
val LocalShownOnTop = compositionLocalOf { false }

/**
 * Marks a screen's own heading as its title, such as a page's title in its content or a detail page's
 * hero, so TalkBack and the keyboard start on it when the learner goes to the screen, and a
 * [PageScaffold]'s bar names the page only once this heading scrolls under the bar. One to a screen.
 */
@Composable
fun Modifier.pageTitle(): Modifier {
    val focus = LocalTitleFocus.current ?: return semantics { heading() }
    val target = focus.heading
    DisposableEffect(target) { onDispose { target.shown = false } }
    return onGloballyPositioned { focus.headingBottom = it.localToScreen(Offset(0f, it.size.height.toFloat())).y }.titleTarget(target)
}

/** The scaffold around a screen's content, whose heading [pageTitle] marks. */
internal val LocalTitleFocus = staticCompositionLocalOf<TitleFocus?> { null }

/**
 * Takes TalkBack and the keyboard to the title of the page or task the learner went to (its bar's,
 * else the heading marked with [pageTitle]), so its name is read first rather than the navigation's
 * first item, and again after the window is recreated. A screen that focused something itself keeps
 * it, and one without a title starts at its first control.
 */
internal class TitleFocus {
    val page = FocusRequester()
    val bar = TitleTarget()
    val heading = TitleTarget()
    var pageHasFocus by mutableStateOf(false)

    // On screen: the page, where its content starts under its top bar, and where its heading ends.
    var area: Rect? = null
    var barBottom by mutableFloatStateOf(0f)
    var headingBottom by mutableFloatStateOf(0f)

    fun content(): Rect? = area?.let { it.copy(top = maxOf(it.top, barBottom)) }

    /** The page's heading is in view below its top bar, so the bar needn't name the page too. */
    fun headingInView(): Boolean = heading.shown && headingBottom > barBottom

    fun shownTitle(): TitleTarget? = listOf(heading, bar).firstOrNull { it.shown }
}

internal class TitleTarget {
    val requester = FocusRequester()
    var shown by mutableStateOf(false)

    // Only a move from here makes the title a stop, as main's headings take focus without joining the tab order.
    var holding by mutableStateOf(false)
}

@Composable
internal fun rememberTitleFocus(): TitleFocus {
    val focus = remember { TitleFocus() }
    val shownOnTop = LocalShownOnTop.current
    val window = LocalWindowInfo.current
    val view = LocalView.current
    val focusManager = LocalFocusManager.current
    val moveFocus = rememberMoveFocus()

    LaunchedEffect(shownOnTop) {
        if (!shownOnTop) return@LaunchedEffect
        // A menu, sheet or dialog that opened the screen holds the window's focus until it closes.
        snapshotFlow { window.isWindowFocused }.first { it }
        // A title can come with the screen's content, once it loads, unless the screen focuses something itself.
        withTimeoutOrNull(2.seconds) { snapshotFlow { focus.shownTitle() != null || focus.pageHasFocus }.first { it } }
        withFrameNanos {}
        if (focus.pageHasFocus) return@LaunchedEffect
        val title = focus.shownTitle()
        if (title == null) {
            moveFocus(focus.page)
            return@LaunchedEffect
        }
        title.holding = true
        moveFocus(title.requester)

        // TalkBack drops a move while it settles after the tap that opened the screen or a window that
        // closed (a menu, a sheet, the keyboard), then starts over at the window's first item (the rail,
        // or the top bar's way back), so the title asks again while TalkBack is there. What the learner
        // picks in the page's content is theirs.
        if (!view.isScreenReaderOn()) return@LaunchedEffect
        repeat(SCREEN_READER_ASKS) {
            delay(500.milliseconds)
            if (!title.holding || view.screenReaderSettled(focus)) return@LaunchedEffect
            // Compose tells TalkBack about focus in batches, so the title stays unfocused long enough to be told apart.
            focusManager.clearFocus()
            delay(200.milliseconds)
            if (focus.pageHasFocus || view.screenReaderSettled(focus)) return@LaunchedEffect
            title.holding = true
            title.requester.requestFocus()
        }
    }
    return focus
}

private const val SCREEN_READER_ASKS = 6

private fun View.isScreenReaderOn(): Boolean = context.getSystemService(AccessibilityManager::class.java)?.isTouchExplorationEnabled == true

private fun View.focused(kind: Int): AccessibilityNodeInfo? = accessibilityNodeProvider?.findFocus(kind)

/** TalkBack is on the title, or on something in the page's content the learner chose. */
private fun View.screenReaderSettled(focus: TitleFocus): Boolean {
    val read = focused(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY) ?: return false
    return read == focused(AccessibilityNodeInfo.FOCUS_INPUT) || read.isIn(focus.content())
}

private fun AccessibilityNodeInfo.isIn(area: Rect?): Boolean {
    val bounds = android.graphics.Rect().also(::getBoundsInScreen)
    return area?.contains(Offset(bounds.exactCenterX(), bounds.exactCenterY())) == true
}

/** Marks the page's top bar, under which its content starts. */
internal fun Modifier.pageBar(focus: TitleFocus): Modifier =
    onGloballyPositioned { focus.barBottom = it.localToScreen(Offset(0f, it.size.height.toFloat())).y }

internal fun Modifier.pageFocus(focus: TitleFocus): Modifier =
    onGloballyPositioned { focus.area = Rect(it.positionOnScreen(), it.size.toSize()) }
        .focusRequester(focus.page)
        .onFocusChanged { focus.pageHasFocus = it.hasFocus }

internal fun Modifier.titleTarget(target: TitleTarget): Modifier =
    onSizeChanged { target.shown = it.width > 0 && it.height > 0 }
        .focusProperties { canFocus = target.holding }
        .onFocusChanged { if (!it.isFocused) target.holding = false }
        .focusRequester(target.requester)
        .focusable()
        .semantics(mergeDescendants = true) { heading() }
