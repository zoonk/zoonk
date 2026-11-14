package com.zoonk.android.ui.testing

import android.content.res.Configuration
import android.graphics.Bitmap
import android.view.View
import android.view.WindowManager
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.LayoutInfo
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import com.zoonk.android.R
import com.zoonk.android.ui.components.LayoutPart
import com.zoonk.android.ui.components.LayoutPartKey
import com.zoonk.android.ui.theme.Geist
import com.zoonk.android.ui.theme.GeistMono
import java.io.File
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.Collections
import java.util.Locale
import java.util.WeakHashMap
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The alignment report's capture of one render (`REPORT-SHAPE.md`): the shared pieces' parts, named by
 * [LayoutPart], read from the unmerged semantics tree in the frame [captureRender] copied. Units are dp,
 * from the picture's top start. What the tree doesn't give is written "not measured", never estimated:
 * a part whose text a parent cleared from the tree has no text layout, and lazy rows that weren't
 * composed aren't there.
 */
internal object LayoutCapture {
    private val captures = Collections.synchronizedMap(WeakHashMap<Bitmap, String>())

    val enabled: Boolean get() = System.getProperty("zoonk.shots").orEmpty().isNotEmpty()

    fun remember(
        bitmap: Bitmap,
        capture: Json.Raw,
    ) {
        captures[bitmap] = capture.json
    }

    fun of(bitmap: Bitmap): String? = captures[bitmap]

    /** A record for a picture whose layout wasn't read, and why. */
    fun notMeasured(reason: String): String =
        Json
            .obj(
                "version" to 1,
                "platform" to "android",
                "screen" to testName(),
                "elements" to NOT_MEASURED,
                "reason" to reason,
            ).json

    fun read(
        captured: SemanticsNode,
        view: View,
        bitmap: Bitmap,
        scenario: String?,
        anchors: Map<String, SemanticsMatcher>,
    ): Json.Raw {
        val owner = requireNotNull(captured.root) { "The captured node has no root" }
        val top = owner.semanticsOwner.unmergedRootSemanticsNode.find(captured.id) ?: captured
        val density = owner.density.density
        val origin = top.positionInRoot
        val reader = Reader(density, origin.x, origin.y, bitmap, surface(view), view.resources)
        reader.elements(top)
        reader.anchors(top, anchors)
        val config = view.resources.configuration
        return Json.obj(
            "version" to 1,
            "platform" to "android",
            "scenario" to (scenario ?: NOT_DECLARED),
            "screen" to testName(),
            "configuration" to configuration(config, bitmap, density),
            "unit" to "dp",
            "scale" to density,
            "activeSurface" to surface(view),
            "elements" to reader.json(),
        )
    }

    private fun configuration(
        config: Configuration,
        bitmap: Bitmap,
        density: Float,
    ) = Json.obj(
        "size" to if (config.smallestScreenWidthDp >= TABLET_WIDTH) "tablet" else "phone",
        "width" to bitmap.width / density,
        "height" to bitmap.height / density,
        "pointer" to "touch",
        "locale" to config.locales[0].toLanguageTag(),
        "textScale" to config.fontScale,
        // Only the configuration's night mode: a test that passes its theme a scheme of its own isn't seen.
        "scheme" to if (config.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES) "dark" else "light",
    )

    /** A dialog's or a sheet's window is its own surface for the one-filled-action check. */
    private fun surface(view: View): String {
        val type = (view.rootView.layoutParams as? WindowManager.LayoutParams)?.type
        return if (type == null || type == WindowManager.LayoutParams.TYPE_BASE_APPLICATION) "page" else "dialog"
    }

    /** The test that captured, for the capture's `screen`: the outermost frame in the app's own test classes. */
    private fun testName(): String =
        Thread
            .currentThread()
            .stackTrace
            .lastOrNull { frame -> frame.className.startsWith("com.zoonk.") && "\$" !in frame.className }
            ?.let { "${it.className.substringAfterLast('.')}.${it.methodName}" }
            ?: "unknown"

    private class Reader(
        val density: Float,
        val originX: Float,
        val originY: Float,
        val bitmap: Bitmap,
        val surface: String,
        val resources: android.content.res.Resources,
    ) {
        private val written = mutableListOf<Element>()
        private val hidden = mutableListOf<Map<String, Any?>>()
        val anchorElements = mutableListOf<Map<String, Any?>>()

        fun elements(top: SemanticsNode) {
            walk(top, group = null, row = null)
            stackGroups()
        }

        fun json(): List<Map<String, Any?>> = written.map { it.json() } + hidden + anchorElements

        private fun walk(
            node: SemanticsNode,
            group: Element?,
            row: Element?,
        ) {
            // Only a main action's fill counts toward one filled action per surface, so other buttons aren't written.
            val part =
                node.config.getOrNull(LayoutPartKey)?.takeUnless {
                    it.part == LayoutPart.Part.Action &&
                        it.variant != LayoutPart.Variant.Filled
                }
            if (part == null && node.config.isClearingSemantics) {
                hidden +=
                    mapOf(
                        "id" to "h${hidden.size}",
                        "part" to "unmeasured",
                        "group" to group?.id,
                        "row" to row?.id,
                        "bounds" to bounds(node),
                        "reason" to CLEARED,
                    )
                return
            }
            var nextGroup = group
            var nextRow = row
            if (part != null) {
                val element = Element("e${written.size}", part, node, group, row)
                written += element
                when (part.part) {
                    LayoutPart.Part.Group -> {
                        nextGroup = element
                        nextRow = null
                    }

                    LayoutPart.Part.Row -> {
                        nextRow = element
                    }

                    else -> {}
                }
            }
            node.children.forEach { walk(it, nextGroup, nextRow) }
        }

        /**
         * Rows no piece frames (a screen's own column of list rows) are grouped by the stack that holds them
         * directly, or through one wrapper such as a lazy list's item, and only while they touch (a hairline
         * between them at most): a heading or a gap starts another list. Its group says so (`"source": "stack"`).
         */
        private fun stackGroups() {
            val loose = written.filter { it.part.part == LayoutPart.Part.Row && it.group == null && it.node != null }
            val chains = loose.associateWith { row -> ancestors(row.node!!.layoutInfo).take(STACK_DEPTH) }
            val stacks =
                loose.groupBy { row ->
                    chains.getValue(row).firstOrNull { layout ->
                        loose.any { other -> other !== row && other.part.piece == row.part.piece && layout in chains.getValue(other) }
                    }
                }
            stacks.forEach { (stack, rows) ->
                if (stack == null) return@forEach
                rows
                    .sortedBy { bounds(it.node!!)[1] }
                    .fold(mutableListOf<MutableList<Element>>()) { lists, row ->
                        val previous = lists.lastOrNull()?.last()?.let { bounds(it.node!!) }
                        val top = bounds(row.node!!)[1]
                        if (previous != null &&
                            top - (previous[1] + previous[3]) <= ADJACENT
                        ) {
                            lists.last() += row
                        } else {
                            lists += mutableListOf(row)
                        }
                        lists
                    }.filter { it.size > 1 }
                    .forEach { list ->
                        val boxes = list.map { bounds(it.node!!) }
                        val left = boxes.minOf { it[0] }
                        val top = boxes.minOf { it[1] }
                        val group =
                            Element("e${written.size}", LayoutPart(list.first().part.piece, LayoutPart.Part.Group), null, null, null)
                        group.stack = listOf(left, top, boxes.maxOf { it[0] + it[2] } - left, boxes.maxOf { it[1] + it[3] } - top)
                        written += group
                        list.forEach { row ->
                            row.group = group
                            written.filter { it.row === row }.forEach { it.group = group }
                        }
                    }
            }
        }

        private fun ancestors(layout: LayoutInfo): List<LayoutInfo> = generateSequence(layout.parentInfo) { it.parentInfo }.toList()

        fun anchors(
            top: SemanticsNode,
            anchors: Map<String, SemanticsMatcher>,
        ) {
            anchors.forEach { (name, matcher) ->
                val nodes = mutableListOf<SemanticsNode>()

                fun visit(node: SemanticsNode) {
                    if (matcher.matches(node)) nodes += node
                    node.children.forEach(::visit)
                }
                visit(top)
                val node = nodes.singleOrNull()
                val element = node?.let { found -> written.firstOrNull { it.node?.id == found.id } }
                when {
                    element != null -> {
                        element.anchor = name
                    }

                    node != null -> {
                        anchorElements +=
                            mapOf("id" to "a:$name", "part" to "anchor", "anchor" to name, "bounds" to bounds(node))
                    }

                    // Not composed (a lazy row off screen) or not one node: written so the pair says so, never as a place.
                    else -> {
                        anchorElements +=
                            mapOf("id" to "a:$name", "part" to "anchor", "anchor" to name, "bounds" to NOT_MEASURED, "found" to nodes.size)
                    }
                }
            }
        }

        private inner class Element(
            val id: String,
            val part: LayoutPart,
            val node: SemanticsNode?,
            var group: Element?,
            val row: Element?,
        ) {
            /** Partly hidden by what holds it (a scroll's edge, a bar over a list): its pixels aren't all its own. */
            private val clipped = node?.let { isClipped(it) } ?: false

            private fun pixelInk(box: List<Float>?): Any? = if (clipped) NOT_MEASURED else box?.let { ink(it) }

            /** A stack group's frame: its rows' bounds together. */
            var stack: List<Float>? = null
            var anchor: String? = null

            fun json(): Map<String, Any?> {
                val fields =
                    linkedMapOf<String, Any?>(
                        "id" to id,
                        "piece" to part.piece,
                        "part" to part.part.id,
                        "group" to group?.id,
                        "row" to row?.id,
                    )
                val box = node?.let { bounds(it) } ?: stack
                fields["bounds"] = box
                when (part.part) {
                    LayoutPart.Part.Group -> {
                        groupFields(fields)
                    }

                    LayoutPart.Part.Row -> {
                        rowFields(fields, box)
                    }

                    LayoutPart.Part.Label, LayoutPart.Part.Note, LayoutPart.Part.Value -> {
                        textFields(fields)
                    }

                    LayoutPart.Part.Action -> {
                        fields["ink"] = pixelInk(box)
                        fields["variant"] = part.variant?.id
                        fields["surface"] = surface
                        node?.let { fields["text"] = text(it) }
                    }

                    else -> {
                        fields["ink"] = pixelInk(box)
                    }
                }
                if (clipped) fields["clipped"] = true
                if (stack != null) fields["source"] = "stack"
                anchor?.let { fields["anchor"] = it }
                return fields
            }

            private fun groupFields(fields: MutableMap<String, Any?>) {
                fields["ink"] = NOT_MEASURED
                val rows = written.filter { it.group === this && it.part.part == LayoutPart.Part.Row }
                // The end edge is on the left in a right-to-left layout.
                val rtl =
                    rows
                        .firstOrNull()
                        ?.node
                        ?.layoutInfo
                        ?.layoutDirection == LayoutDirection.Rtl
                val ends =
                    rows.mapNotNull { row ->
                        val inset = row.part.endInset?.value ?: return@mapNotNull null
                        val box = row.node?.let { bounds(it) } ?: return@mapNotNull null
                        if (rtl) box[0] + inset else box[0] + box[2] - inset
                    }
                fields["endEdge"] = (if (rtl) ends.maxOrNull() else ends.minOrNull()) ?: NOT_MEASURED
                fields["gap"] = part.gap?.value ?: NOT_MEASURED
                if (rtl) fields["direction"] = "rtl"
            }

            private fun rowFields(
                fields: MutableMap<String, Any?>,
                box: List<Float>?,
            ) {
                fields["ink"] = pixelInk(box)
                fields["margins"] = listOf(0, 0)
                fields["note"] = written.any { it.row === this && it.part.part == LayoutPart.Part.Note }
            }

            private fun textFields(fields: MutableMap<String, Any?>) {
                val node = node ?: return
                // Texts with words: an empty text (a value with nothing to say yet) draws no glyphs.
                val texts =
                    textNodes(node).mapNotNull { text ->
                        textLayout(text)?.takeIf { it.layoutInput.text.isNotEmpty() }?.let {
                            text to
                                it
                        }
                    }
                fields["text"] = text(node)
                val (text, layout) =
                    texts.firstOrNull() ?: run {
                        fields["ink"] = pixelInk(bounds(node))
                        listOf("baseline", "capTop", "capBottom", "lines", "type").forEach { fields[it] = NOT_MEASURED }
                        return
                    }
                val lines = texts.map { (each, result) -> lineBox(each, result) }
                val left = lines.minOf { it[0] }
                val top = lines.minOf { it[1] }
                // A cut-off paragraph's line boxes reach past what the picture shows.
                fields["ink"] =
                    if (clipped) {
                        NOT_MEASURED
                    } else {
                        listOf(
                            left,
                            top,
                            lines.maxOf { it[0] + it[2] } - left,
                            lines.maxOf { it[1] + it[3] } - top,
                        )
                    }
                val y =
                    (
                        text.layoutInfo.coordinates
                            .positionInRoot()
                            .y - originY
                    ) / density
                val baseline = y + layout.firstBaseline / density
                fields["baseline"] = baseline
                val capHeight = capHeight(layout)
                fields["capTop"] = capHeight?.let { baseline - it } ?: NOT_MEASURED
                fields["capBottom"] = if (capHeight != null) baseline else NOT_MEASURED
                // Every line the part's words take, when it stacks more than one text; texts side by side share theirs.
                fields["lines"] =
                    texts
                        .flatMap { (each, result) ->
                            val top =
                                each.layoutInfo.coordinates
                                    .positionInRoot()
                                    .y
                            (0 until result.lineCount).map { ((top + result.getLineTop(it)) / density).roundToInt() }
                        }.distinct()
                        .size
                fields["type"] = type(layout)
                // How many texts the part holds: a row's descriptions count one each toward E5's lines.
                fields["texts"] = texts.size
            }
        }

        /**
         * A text's paragraph can be laid out at the width it was offered while the text takes less: its lines'
         * positions are the paragraph's, and an end-aligned or centered line is drawn that much further in.
         */
        private fun alignmentShift(layout: TextLayoutResult): Float {
            val extra = layout.size.width - layout.multiParagraph.width
            val rtl = layout.layoutInput.layoutDirection == LayoutDirection.Rtl
            return when (layout.layoutInput.style.textAlign) {
                TextAlign.Center -> extra / 2
                TextAlign.Right -> extra
                TextAlign.End -> if (rtl) 0f else extra
                TextAlign.Left -> 0f
                else -> if (rtl) extra else 0f
            }
        }

        /** A text's glyphs' line boxes, from its first line's top to its last line's bottom. */
        private fun lineBox(
            text: SemanticsNode,
            layout: TextLayoutResult,
        ): List<Float> {
            val origin = text.layoutInfo.coordinates.positionInRoot()
            val x = (origin.x - originX + alignmentShift(layout)) / density
            val y = (origin.y - originY) / density
            val last = layout.lineCount - 1
            val left = (0..last).minOf { layout.getLineLeft(it) } / density
            val right = (0..last).maxOf { layout.getLineRight(it) } / density
            return listOf(
                x + left,
                y + layout.getLineTop(0) / density,
                right - left,
                (layout.getLineBottom(last) - layout.getLineTop(0)) / density,
            )
        }

        /** The part's own text, or the texts inside it, in order. */
        private fun textNodes(node: SemanticsNode): List<SemanticsNode> =
            if (node.config.getOrNull(SemanticsActions.GetTextLayoutResult) != null) {
                listOf(node)
            } else {
                node.children.flatMap { textNodes(it) }
            }

        private fun textLayout(node: SemanticsNode): TextLayoutResult? {
            val results = mutableListOf<TextLayoutResult>()
            node.config
                .getOrNull(SemanticsActions.GetTextLayoutResult)
                ?.action
                ?.invoke(results)
            return results.firstOrNull()
        }

        private fun text(node: SemanticsNode): String {
            val words = mutableListOf<String>()

            fun visit(node: SemanticsNode) {
                node.config.getOrNull(SemanticsProperties.Text)?.forEach { words += it.text }
                node.children.forEach(::visit)
            }
            visit(node)
            return words.joinToString(" ")
        }

        /**
         * The font's own cap height (its `OS/2` table), for the two faces the app ships, when that face drew every
         * character: Japanese, Korean or Arabic in a Geist style is drawn by a system font whose capitals sit
         * elsewhere, so such text, mixed text included, isn't measured. Neither is text with a span in another family.
         */
        private fun capHeight(layout: TextLayoutResult): Float? {
            val style = layout.layoutInput.style
            val text = layout.layoutInput.text
            if (text.spanStyles.any { it.item.fontFamily != null && it.item.fontFamily != style.fontFamily }) return null
            if (!FontFiles.covers(style.fontFamily, text.text, resources)) return null
            val ratio = FontFiles.capRatio(style.fontFamily, resources) ?: return null
            val size = with(layout.layoutInput.density) { style.fontSize.toPx() }
            return ratio * size / density
        }

        private fun type(layout: TextLayoutResult): String {
            val style = layout.layoutInput.style
            val family =
                when (style.fontFamily) {
                    Geist -> "Geist"
                    GeistMono -> "GeistMono"
                    null -> "default"
                    else -> "other"
                }
            val lineHeight =
                style.lineHeight.value
                    .takeUnless { it.isNaN() }
                    ?.let(::decimals) ?: "auto"
            return "$family ${decimals(style.fontSize.value)} ${style.fontWeight?.weight ?: 400} $lineHeight"
        }

        private fun isClipped(node: SemanticsNode): Boolean {
            val shown = node.boundsInRoot
            val whole = node.positionInRoot
            return abs(shown.left - whole.x) > HALF_PIXEL ||
                abs(shown.top - whole.y) > HALF_PIXEL ||
                abs(shown.width - node.size.width) > HALF_PIXEL ||
                abs(shown.height - node.size.height) > HALF_PIXEL
        }

        fun bounds(node: SemanticsNode): List<Float> {
            val position = node.positionInRoot
            return listOf(
                (position.x - originX) / density,
                (position.y - originY) / density,
                node.size.width / density,
                node.size.height / density,
            )
        }

        /**
         * What is drawn inside a known box: the pixels that differ from the box's edge color. A box that
         * reaches past the picture, or draws nothing, has no ink.
         */
        private fun ink(box: List<Float>): Any? {
            val area = Rect(box[0] * density, box[1] * density, (box[0] + box[2]) * density, (box[1] + box[3]) * density)
            val left = area.left.toInt().coerceAtLeast(0)
            val top = area.top.toInt().coerceAtLeast(0)
            val right = area.right.toInt().coerceAtMost(bitmap.width)
            val bottom = area.bottom.toInt().coerceAtMost(bitmap.height)
            if (right - left < 2 || bottom - top < 2) return NOT_MEASURED
            val width = right - left
            val pixels = IntArray(width * (bottom - top))
            bitmap.getPixels(pixels, 0, width, left, top, width, bottom - top)
            val edge = (0 until width).map { pixels[it] } + (0 until width).map { pixels[pixels.size - width + it] }
            val background =
                edge
                    .groupingBy { it }
                    .eachCount()
                    .maxBy { it.value }
                    .key
            var minX = Int.MAX_VALUE
            var minY = Int.MAX_VALUE
            var maxX = -1
            var maxY = -1
            pixels.forEachIndexed { index, color ->
                if (differs(color, background)) {
                    val px = index % width
                    val py = index / width
                    if (px < minX) minX = px
                    if (px > maxX) maxX = px
                    if (py < minY) minY = py
                    if (py > maxY) maxY = py
                }
            }
            if (maxX < 0) return null
            return listOf(
                (left + minX) / density,
                (top + minY) / density,
                (maxX - minX + 1) / density,
                (maxY - minY + 1) / density,
            )
        }

        private fun differs(
            a: Int,
            b: Int,
        ): Boolean = (0..3).any { shift -> abs((a shr (shift * 8) and 0xFF) - (b shr (shift * 8) and 0xFF)) > INK_THRESHOLD }
    }

    /** The app's two faces, read from their files: cap height per em (`OS/2`, `head`) and the characters they draw (`cmap`). */
    private object FontFiles {
        private class Face(
            val capRatio: Float?,
            val draws: (Int) -> Boolean,
        )

        private val faces = mutableMapOf<Int, Face>()

        fun capRatio(
            family: FontFamily?,
            resources: android.content.res.Resources,
        ): Float? = face(family, resources)?.capRatio

        /** Whether [family]'s own file draws every character of [text], so no fallback font drew any of it. */
        fun covers(
            family: FontFamily?,
            text: String,
            resources: android.content.res.Resources,
        ): Boolean {
            val face = face(family, resources) ?: return false
            return text.codePoints().allMatch { it < ' '.code || face.draws(it) }
        }

        private fun face(
            family: FontFamily?,
            resources: android.content.res.Resources,
        ): Face? {
            val id =
                when (family) {
                    Geist -> R.font.geist
                    GeistMono -> R.font.geist_mono
                    else -> return null
                }
            return faces.getOrPut(id) { read(resources.openRawResource(id).use { it.readBytes() }) }
        }

        private fun read(bytes: ByteArray): Face {
            val font = ByteBuffer.wrap(bytes)
            val tables = font.getShort(4).toInt()

            fun table(tag: String): Int? =
                (0 until tables).firstNotNullOfOrNull { index ->
                    val entry = 12 + index * 16
                    val found = String(bytes, entry, 4, Charsets.US_ASCII)
                    if (found == tag) font.getInt(entry + 8) else null
                }
            val head = table("head")
            val os2 = table("OS/2")
            val capRatio =
                if (head == null || os2 == null || font.getShort(os2).toInt() < 2) {
                    null
                } else {
                    font.getShort(os2 + 88).toFloat() / (font.getShort(head + 18).toInt() and 0xFFFF)
                }
            return Face(capRatio, table("cmap")?.let { characterMap(font, it) } ?: { false })
        }

        /** The Unicode subtable of a `cmap`: format 12 (every plane) when there is one, else format 4 (the first plane). */
        private fun characterMap(
            font: ByteBuffer,
            cmap: Int,
        ): ((Int) -> Boolean)? {
            val subtables =
                (0 until u16(font, cmap + 2)).map { index ->
                    val record = cmap + 4 + index * 8
                    cmap + font.getInt(record + 4)
                }
            subtables.firstOrNull { u16(font, it) == 12 }?.let { table ->
                val groups =
                    (0 until font.getInt(table + 12)).map { index ->
                        val group = table + 16 + index * 12
                        font.getInt(group).toLong()..font.getInt(group + 4).toLong()
                    }
                return { code -> groups.any { code.toLong() in it } }
            }
            val table = subtables.firstOrNull { u16(font, it) == 4 } ?: return null
            val segments = u16(font, table + 6) / 2
            val ends = table + 14
            val starts = ends + segments * 2 + 2
            val deltas = starts + segments * 2
            val offsets = deltas + segments * 2
            return { code ->
                (0 until segments).any { index ->
                    val start = u16(font, starts + index * 2)
                    val end = u16(font, ends + index * 2)
                    code in start..end && glyph(font, code, start, deltas + index * 2, offsets + index * 2) != 0
                }
            }
        }

        private fun glyph(
            font: ByteBuffer,
            code: Int,
            start: Int,
            delta: Int,
            offset: Int,
        ): Int {
            val rangeOffset = u16(font, offset)
            if (rangeOffset == 0) return (code + font.getShort(delta)) and 0xFFFF
            val found = u16(font, offset + rangeOffset + (code - start) * 2)
            return if (found == 0) 0 else (found + font.getShort(delta)) and 0xFFFF
        }

        private fun u16(
            font: ByteBuffer,
            at: Int,
        ) = font.getShort(at).toInt() and 0xFFFF
    }

    /** Why an area is written as unmeasured: whatever it holds was taken out of the tree, for TalkBack to read one phrase. */
    private const val CLEARED = "a parent replaced its children's semantics"

    /** How far up a list's stack can be from its rows: their parent, or the parent of a wrapper. */
    private const val STACK_DEPTH = 2

    /** The most two rows of one list are apart: the hairline between them. */
    private const val ADJACENT = 2f
    private const val HALF_PIXEL = 0.5f
    private const val NOT_DECLARED = "not declared"
    private const val INK_THRESHOLD = 24
    private const val TABLET_WIDTH = 600

    private fun SemanticsNode.find(id: Int): SemanticsNode? {
        if (this.id == id) return this
        children.forEach { child -> child.find(id)?.let { return it } }
        return null
    }
}

/**
 * Writes a review picture and, when it came from [captureRender] while `-Pzoonk.shots` is set, its layout
 * capture beside it (`<name>.json`, which `pnpm verify:alignment` reads), with the picture's manifest item:
 * the file's hash and the build the test ran from (`zoonk.build.commit`, and a digest of uncommitted
 * changes or "clean").
 */
fun writeRender(
    file: File,
    bitmap: Bitmap,
) {
    file.parentFile?.mkdirs()
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    if (!LayoutCapture.enabled) return
    val sha = MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(Locale.ROOT, it) }
    val item =
        Json.obj(
            "file" to file.name,
            "sha256" to sha,
            "build" to
                Json.obj(
                    "commit" to System.getProperty("zoonk.build.commit").orEmpty().ifEmpty { "unknown" },
                    "uncommitted" to System.getProperty("zoonk.build.uncommitted").orEmpty().ifEmpty { "unknown" },
                ),
        )
    // A picture that isn't the frame captureRender copied (a copy, or several windows drawn together) says so.
    val capture = LayoutCapture.of(bitmap) ?: LayoutCapture.notMeasured(NOT_ONE_FRAME)
    // The capture is the shared report's capture file; `picture` is its PNG's manifest item.
    File(file.parentFile, file.nameWithoutExtension + ".json").writeText("{\"picture\":${item.json},${capture.removePrefix("{")}\n")
}

/** Just enough JSON for the capture: maps, lists, strings, numbers, booleans and null. */
internal object Json {
    /** Text that is already JSON. */
    class Raw(
        val json: String,
    )

    fun obj(vararg fields: Pair<String, Any?>): Raw = Raw(write(linkedMapOf(*fields)))

    fun write(value: Any?): String =
        when (value) {
            null -> "null"
            is Raw -> value.json
            is String -> quote(value)
            is Boolean -> value.toString()
            is Float -> if (value.isNaN()) quote(NOT_MEASURED) else decimals(value)
            is Double -> write(value.toFloat())
            is Number -> value.toString()
            is Map<*, *> -> value.entries.joinToString(",", "{", "}") { (key, item) -> "${quote(key.toString())}:${write(item)}" }
            is List<*> -> value.joinToString(",", "[", "]") { write(it) }
            else -> quote(value.toString())
        }

    private fun quote(text: String): String =
        buildString {
            append('"')
            text.forEach { char ->
                when {
                    char == '"' -> append("\\\"")
                    char == '\\' -> append("\\\\")
                    char < ' ' -> append("\\u%04x".format(Locale.ROOT, char.code))
                    else -> append(char)
                }
            }
            append('"')
        }
}

/** Two decimals: a hundredth of a dp is finer than any device pixel. */
private fun decimals(value: Float): String = "%.2f".format(Locale.ROOT, value).trimEnd('0').trimEnd('.')

private const val NOT_MEASURED = "not measured"
private const val NOT_ONE_FRAME = "the picture isn't the one frame captureRender copied: a copy, or several windows drawn together"
