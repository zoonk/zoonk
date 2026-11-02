package com.zoonk.android.feature.activities.music

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

data class NotationElementId(
    val bar: Int,
    val index: Int,
)

/**
 * A tune laid out to draw, in the units it was laid out in (dp). Lines wrap a few bars at a time, as main's abcjs staves do,
 * and every line but a short last one is spread to the full width.
 */
internal class NotationDrawing(
    val items: List<Item>,
    val height: Float,
) {
    enum class TextKind { ChordSymbol, TabFret, TupletNumber, EndingNumber }

    sealed interface Mark {
        fun moved(dy: Float): Mark

        data class Glyph(
            val glyph: MusicGlyph,
            val x: Float,
            val y: Float,
            val scale: Float,
        ) : Mark {
            override fun moved(dy: Float) = copy(y = y + dy)
        }

        data class Box(
            val left: Float,
            val top: Float,
            val width: Float,
            val height: Float,
        ) : Mark {
            override fun moved(dy: Float) = copy(top = top + dy)
        }

        data class Beam(
            val points: List<Pair<Float, Float>>,
        ) : Mark {
            override fun moved(dy: Float) = copy(points = points.map { (x, y) -> x to y + dy })
        }

        data class Tie(
            val fromX: Float,
            val toX: Float,
            val y: Float,
            val controlY: Float,
            val width: Float,
        ) : Mark {
            override fun moved(dy: Float) = copy(y = y + dy, controlY = controlY + dy)
        }

        data class Bracket(
            val points: List<Pair<Float, Float>>,
            val width: Float,
        ) : Mark {
            override fun moved(dy: Float) = copy(points = points.map { (x, y) -> x to y + dy })
        }

        /** Placed by its kind: a chord symbol's bottom left, an ending number's top left, the center of the rest. */
        data class Text(
            val text: String,
            val x: Float,
            val y: Float,
            val kind: TextKind,
        ) : Mark {
            override fun moved(dy: Float) = copy(y = y + dy)
        }
    }

    data class Item(
        val mark: Mark,
        val element: NotationElementId? = null,
    )

    companion object {
        /**
         * [space] is a staff space, [tabSpace] the space between tab lines (null draws no tab), and [textHeight] a line of the
         * texts' font, so a line of music leaves room for its chord symbols at any text size.
         */
        fun of(
            tune: AbcTune,
            width: Float,
            space: Float,
            tabSpace: Float?,
            textHeight: Float,
        ): NotationDrawing = NotationLayout(tune, width, space, tabSpace, textHeight).draw()
    }
}

private class NotationLayout(
    private val tune: AbcTune,
    private val width: Float,
    private val space: Float,
    private val tabSpace: Float?,
    private val textHeight: Float,
) {
    /** The key signature in force: the tune's, until a bar changes it. */
    private var fifths = tune.fifths

    private val items = mutableListOf<NotationDrawing.Item>()
    private val scale = space / MusicGlyph.STAFF_SPACE
    private val stemWidth = max(space * 0.12f, 1f)
    private val lineWidth = max(space * 0.1f, 0.75f)
    private val preferredBars = if (width < WIDE_STAFF) 2 else 4

    /** The bottom line of the staff: E4 on a treble staff, G2 on a bass staff. */
    private val bottomStep = if (tune.clef == AbcTune.Clef.Treble) 30 else 18

    private val tabTop = space * 7.5f

    /** Ties from a bar's last note, drawn once the next bar on the line places the note they hold. */
    private val pendingTies = mutableListOf<Pair<Placed, AbcTune.Pitch>>()

    private class Placed(
        val id: NotationElementId,
        val element: AbcTune.Element,
        val x: Float,
        val headWidth: Float,
    )

    fun draw(): NotationDrawing {
        val lines = breakLines()
        var top = 0f
        var previousStretch: Float? = null

        lines.forEachIndexed { number, line ->
            val start = items.size
            previousStretch = drawLine(line, isFirst = number == 0, isLast = number == lines.lastIndex, previous = previousStretch)

            val extents = items.subList(start, items.size).map { extent(it.mark) }
            val minY = extents.minOf { it.first }
            val maxY = extents.maxOf { it.second }
            val shift = top - minY

            for (index in start until items.size) items[index] = items[index].copy(mark = items[index].mark.moved(shift))

            top += maxY - minY + space * LINE_GAP
        }

        return NotationDrawing(items.toList(), max(top - space * LINE_GAP, 0f))
    }

    private fun breakLines(): List<List<Int>> {
        val lines = mutableListOf<List<Int>>()
        var current = mutableListOf<Int>()
        var used = headerWidth(isFirst = true)

        for (bar in tune.bars.indices.filter { tune.bars[it].elements.isNotEmpty() }) {
            val barWidth = idealWidth(bar)

            if (current.isNotEmpty() && (current.size >= preferredBars || used + barWidth > width)) {
                lines += current
                current = mutableListOf()
                used = headerWidth(isFirst = false)
            }

            current += bar
            used += barWidth
        }

        if (current.isNotEmpty()) lines += current

        return lines
    }

    private val keyWidth: Float
        get() = if (tune.fifths == 0) 0f else abs(tune.fifths) * space * 1.05f + space * 0.6f

    private fun headerWidth(isFirst: Boolean): Float {
        val meter = if (isFirst && tune.meter != AbcTune.Meter.None) space * 2.4f else 0f
        return space * 3.4f + keyWidth + meter
    }

    /** Room for a note of [length] whole notes: an eighth gets 2.6 spaces, each doubling about 1.4 times more, as engravers space by the square root of the length. */
    private fun idealSpace(length: Double): Float = space * 2.6f * sqrt(max(length, 1.0 / 64) / 0.125).toFloat()

    private fun minimumSpace(element: AbcTune.Element): Float {
        val hasAccidental = element.pitches.any { it.accidental != null }
        val dots = noteType(element.written).dots
        return space * (1.9f + (if (hasAccidental) 1.2f else 0f) + dots * 0.6f)
    }

    private fun elementWidth(element: AbcTune.Element): Float = max(idealSpace(element.written), minimumSpace(element))

    private fun idealWidth(bar: Int): Float {
        val data = tune.bars[bar]
        return data.elements.fold(space * 1.6f) { total, element -> total + elementWidth(element) } +
            (if (data.startsRepeat) space * 1.5f else 0f) +
            data.elements.indices
                .sumOf { keyChangeWidth(NotationElementId(bar, it)).toDouble() }
                .toFloat()
    }

    /** Draws one line and returns how much it stretched its bars: full lines fill the width, and a short last line keeps the spacing of the line before it. */
    private fun drawLine(
        bars: List<Int>,
        isFirst: Boolean,
        isLast: Boolean,
        previous: Float?,
    ): Float {
        tune.bars[bars.first()]
            .elements
            .first()
            .fifths
            ?.let { fifths = it }

        val start = items.size
        var x = drawHeader(isFirst)
        val natural = bars.sumOf { idealWidth(it).toDouble() }.toFloat()
        val fill = (width - x) / max(natural, 1f)
        val stretch =
            when {
                !isLast || fill <= 1 -> fill
                previous != null -> min(fill, previous)
                natural >= (width - x) * 0.6f -> fill
                else -> 1f
            }

        for (bar in bars) x = drawBar(bar, x, stretch, startsLine = bar == bars.first())

        drawPendingTies(x - space * 0.3f)
        alignChordSymbols(start)
        drawStaff(x)
        tabSpace?.let { drawTabLines(x, it) }

        return stretch
    }

    /** A line's chord symbols share one row, over its highest note, as abcjs sets them. */
    private fun alignChordSymbols(start: Int) {
        val symbols =
            (start until items.size).filter {
                (items[it].mark as? NotationDrawing.Mark.Text)?.kind ==
                    NotationDrawing.TextKind.ChordSymbol
            }
        val row = symbols.minOfOrNull { (items[it].mark as NotationDrawing.Mark.Text).y } ?: return

        for (index in symbols) items[index] = items[index].copy(mark = (items[index].mark as NotationDrawing.Mark.Text).copy(y = row))
    }

    /** The height of staff position [position], in half spaces up from the bottom line. */
    private fun y(position: Int): Float = space * 4 - position * space / 2

    private fun position(step: Int): Int = step - bottomStep

    private fun drawStaff(end: Float) {
        for (line in 0 until 5) add(NotationDrawing.Mark.Box(0f, line * space - lineWidth / 2, end, lineWidth))
        add(NotationDrawing.Mark.Box(0f, 0f, lineWidth * 1.5f, space * 4))
    }

    private fun drawTabLines(
        end: Float,
        tabSpace: Float,
    ) {
        val bounds = MusicGlyph.TabClef.bounds
        glyph(MusicGlyph.TabClef, space * 0.5f, tabTop + tabSpace * 2.5f - (bounds.top + bounds.bottom) / 2 * scale)
        add(NotationDrawing.Mark.Box(0f, tabTop, lineWidth * 1.5f, tabSpace * 5))
        for (line in 0 until 6) add(NotationDrawing.Mark.Box(0f, tabTop + line * tabSpace - lineWidth / 2, end, lineWidth))
    }

    private fun glyph(
        glyph: MusicGlyph,
        x: Float,
        y: Float,
        element: NotationElementId? = null,
    ) = add(NotationDrawing.Mark.Glyph(glyph, x, y, scale), element)

    private fun drawHeader(isFirst: Boolean): Float {
        if (tune.clef == AbcTune.Clef.Treble) {
            glyph(MusicGlyph.TrebleClef, space * 0.5f, y(2))
        } else {
            glyph(MusicGlyph.BassClef, space * 0.5f, y(6))
        }

        val x = drawKeySignature(space * 3.4f)
        return if (isFirst) drawMeter(x) else x
    }

    private fun drawKeySignature(start: Float): Float {
        val offset = if (tune.clef == AbcTune.Clef.Treble) 0 else -2
        var x = start

        for (index in 0 until abs(fifths)) {
            val position = (if (fifths > 0) SHARP_POSITIONS else FLAT_POSITIONS)[index] + offset
            glyph(if (fifths > 0) MusicGlyph.Sharp else MusicGlyph.Flat, x, y(position))
            x += space * 1.05f
        }

        return if (fifths == 0) x else x + space * 0.6f
    }

    /** Each key change with the key it replaces, by the note it comes before. */
    private val keyChanges: Map<NotationElementId, Pair<Int, Int>> =
        buildMap {
            var key = tune.fifths
            tune.bars.forEachIndexed { bar, data ->
                data.elements.forEachIndexed { index, element ->
                    element.fifths?.let {
                        put(NotationElementId(bar, index), key to it)
                        key = it
                    }
                }
            }
        }

    private fun keyChangeWidth(id: NotationElementId): Float =
        keyChanges[id]?.let { (from, to) -> (cancelled(from, to).count() + abs(to)) * space * 1.05f + space * 1.1f } ?: 0f

    /** Which of the old signature's accidentals a new one drops: all of them when sharps turn to flats or the reverse. */
    private fun cancelled(
        from: Int,
        to: Int,
    ): IntRange = if (from * to > 0) abs(to) until abs(from) else 0 until abs(from)

    private fun drawNaturals(
        from: Int,
        to: Int,
        start: Float,
    ): Float {
        val offset = if (tune.clef == AbcTune.Clef.Treble) 0 else -2
        var x = start

        for (index in cancelled(from, to)) {
            glyph(MusicGlyph.Natural, x, y((if (from > 0) SHARP_POSITIONS else FLAT_POSITIONS)[index] + offset))
            x += space * 1.05f
        }

        return x
    }

    private fun drawMeter(start: Float): Float {
        when (val meter = tune.meter) {
            AbcTune.Meter.None -> {
                return start
            }

            AbcTune.Meter.Common -> {
                glyph(MusicGlyph.CommonTime, start, y(4))
            }

            AbcTune.Meter.Cut -> {
                glyph(MusicGlyph.CutTime, start, y(4))
            }

            is AbcTune.Meter.Fraction -> {
                val top = digits(meter.num)
                val bottom = digits(meter.den)
                val topWidth = top.sumOf { it.width.toDouble() }.toFloat() * scale
                val bottomWidth = bottom.sumOf { it.width.toDouble() }.toFloat() * scale
                val widest = max(topWidth, bottomWidth)

                drawDigits(top, start + (widest - topWidth) / 2, y(4))
                drawDigits(bottom, start + (widest - bottomWidth) / 2, y(0))
            }
        }

        return start + space * 2.4f
    }

    private fun drawDigits(
        digits: List<MusicGlyph>,
        start: Float,
        y: Float,
    ) {
        var x = start

        for (digit in digits) {
            glyph(digit, x, y)
            x += digit.width * scale
        }
    }

    private fun digits(number: Int): List<MusicGlyph> = number.toString().map { DIGITS[it.digitToInt()] }

    private fun drawBar(
        bar: Int,
        start: Float,
        stretch: Float,
        startsLine: Boolean,
    ): Float {
        val data = tune.bars[bar]
        var x = start

        if (data.startsRepeat) {
            add(NotationDrawing.Mark.Box(x + space * 0.2f, 0f, space * 0.45f, space * 4))
            add(NotationDrawing.Mark.Box(x + space * 0.85f, 0f, stemWidth, space * 4))
            repeatDots(x + space * 1.35f)
            x += space * 1.5f
        }

        x += space * stretch

        val notesStart = x
        val placed =
            data.elements.mapIndexed { index, element ->
                val change = keyChanges[NotationElementId(bar, index)]

                // A key change mid-line cancels the old signature and shows the new one where it starts; at a line's start the header shows it.
                if (change != null && !(startsLine && index == 0)) {
                    x = drawNaturals(change.first, change.second, x + space * 0.5f)
                    fifths = change.second
                    x = drawKeySignature(x)
                }

                val hasAccidental = element.pitches.any { it.accidental != null }
                val head = if (element.isRest) 0f else head(noteType(element.written).base).width * scale
                val item = Placed(NotationElementId(bar, index), element, x + if (hasAccidental) space * 1.2f else 0f, head)
                x += elementWidth(element) * stretch
                item
            }

        val barEnd = x + space * 0.6f * stretch
        val centered =
            placed.map {
                if (it.element.fillsBar) {
                    Placed(
                        it.id,
                        it.element,
                        (notesStart + barEnd - MusicGlyph.WholeRest.width * scale) / 2,
                        0f,
                    )
                } else {
                    it
                }
            }

        drawPendingTies(centered.first().x - space * 0.2f)
        drawElements(centered)
        drawBarLine(data, barEnd)
        data.ending?.let { drawEnding(it, start, barEnd, closes = data.endsRepeat || data.end == AbcTune.BarLine.Final) }

        return barEnd
    }

    private fun repeatDots(x: Float) {
        for (position in listOf(3, 5)) glyph(MusicGlyph.Dot, x, y(position))
    }

    private fun drawBarLine(
        bar: AbcTune.Bar,
        x: Float,
    ) {
        val thin = stemWidth
        val thick = space * 0.45f

        tabSpace?.let { add(NotationDrawing.Mark.Box(x - thin, tabTop, thin, it * 5)) }

        if (bar.endsRepeat) {
            repeatDots(x - space * 1.6f)
            add(NotationDrawing.Mark.Box(x - space * 0.95f, 0f, thin, space * 4))
            add(NotationDrawing.Mark.Box(x - thick, 0f, thick, space * 4))
            return
        }

        when (bar.end) {
            AbcTune.BarLine.Double -> {
                add(NotationDrawing.Mark.Box(x - space * 0.5f, 0f, thin, space * 4))
                add(NotationDrawing.Mark.Box(x - thin, 0f, thin, space * 4))
            }

            AbcTune.BarLine.Final -> {
                add(NotationDrawing.Mark.Box(x - space * 0.85f, 0f, thin, space * 4))
                add(NotationDrawing.Mark.Box(x - thick, 0f, thick, space * 4))
            }

            AbcTune.BarLine.Single, AbcTune.BarLine.None -> {
                add(NotationDrawing.Mark.Box(x - thin, 0f, thin, space * 4))
            }
        }
    }

    /** An ending closes its bracket where it goes back to its repeat or the tune ends, as abcjs draws them. */
    private fun drawEnding(
        ending: Int,
        start: Float,
        end: Float,
        closes: Boolean,
    ) {
        val top = -space * 3.2f
        val left = start + space * 0.3f
        val right = end - space * 0.3f
        val bracket =
            listOf(left to top + space * 1.4f, left to top, right to top) + if (closes) listOf(right to top + space * 1.4f) else emptyList()

        add(NotationDrawing.Mark.Bracket(bracket, stemWidth))
        add(NotationDrawing.Mark.Text("$ending", start + space * 0.8f, top + space * 0.2f, NotationDrawing.TextKind.EndingNumber))
    }

    private fun drawElements(placed: List<Placed>) {
        val beamUp = mutableMapOf<Int, Boolean>()

        for (group in beamGroups(placed)) {
            val up = stemsUp(group.map { placed[it].element })
            drawBeamGroup(group.map { placed[it] }, up)
            group.forEach { beamUp[it] = up }
        }

        placed.forEachIndexed { index, item ->
            if (item.element.isRest) drawRest(item) else drawNote(item, beamUp[index])

            item.element.chordSymbol?.let { symbol ->
                val y = min(-space * 1.4f, topOfNote(item) - space * 1.2f)
                add(NotationDrawing.Mark.Text(symbol, item.x, y, NotationDrawing.TextKind.ChordSymbol), item.id)
            }

            item.element.tuplet?.let { tuplet ->
                val lastIndex = index + min(tuplet.count - 1, placed.lastIndex - index)
                val last = placed[lastIndex]
                val isUp = stemsUp(placed.subList(index, lastIndex + 1).map { it.element })
                val centerX = (item.x + last.x + last.headWidth) / 2
                val edge =
                    if (isUp) {
                        min(topOfNote(item), topOfNote(last)) - space * 1.6f
                    } else {
                        max(bottomOfNote(item), bottomOfNote(last)) + space * 1.2f
                    }
                add(NotationDrawing.Mark.Text("${tuplet.number}", centerX, edge, NotationDrawing.TextKind.TupletNumber))
            }

            val next = placed.getOrNull(index + 1)

            for (pitch in item.element.pitches) {
                if (!pitch.isTied) continue
                if (next != null) drawTie(item, pitch, next.x - space * 0.2f) else pendingTies += item to pitch
            }
        }

        if (tabSpace != null) for (item in placed) if (!item.element.isRest) drawTab(item)
    }

    private fun positions(element: AbcTune.Element): List<Int> = element.pitches.map { position(it.step) }.sorted()

    private fun stemsUp(elements: List<AbcTune.Element>): Boolean {
        val all = elements.flatMap { positions(it) }
        return all.isEmpty() || all.average() < 4
    }

    private fun topOfNote(item: Placed): Float {
        val headTop = y(positions(item.element).lastOrNull() ?: 4) - space * 0.5f
        val isStemUp = noteType(item.element.written).base < 1 && stemsUp(listOf(item.element))
        return if (isStemUp) min(headTop, stemEnd(item, up = true)) else min(headTop, 0f)
    }

    private fun bottomOfNote(item: Placed): Float {
        val headBottom = y(positions(item.element).firstOrNull() ?: 4) + space * 0.5f
        return max(headBottom, space * 4)
    }

    private fun stemLength(base: Double): Float = space * (3.5f + max(flagCount(base) - 1, 0) * 0.75f)

    /** Where a lone note's stem ends: three and a half spaces from its outer head, and at least to the middle line for notes far off the staff. */
    private fun stemEnd(
        item: Placed,
        up: Boolean,
    ): Float {
        val positions = positions(item.element)
        val length = stemLength(noteType(item.element.written).base)

        return if (up) min(y(positions.lastOrNull() ?: 4) - length, y(4)) else max(y(positions.firstOrNull() ?: 4) + length, y(4))
    }

    private fun stemX(
        item: Placed,
        up: Boolean,
    ): Float = if (up) item.x + item.headWidth - stemWidth / 2 else item.x + stemWidth / 2

    /** [beamUp] is the direction of the beam the note joins, or null for a note on its own. */
    private fun drawNote(
        item: Placed,
        beamUp: Boolean?,
    ) {
        val type = noteType(item.element.written)
        val up = beamUp ?: stemsUp(listOf(item.element))
        val head = head(type.base)
        val sorted = item.element.pitches.sortedBy { it.step }
        var previous: Int? = null
        var shifted = false

        // In a second the higher note sits to the right: stem up, it moves past the stem; stem down, the lower note moves left of it.
        for (pitch in if (up) sorted else sorted.reversed()) {
            val position = position(pitch.step)
            shifted = if (previous != null && abs(position - previous) == 1) !shifted else false
            val offset =
                if (!shifted) {
                    0f
                } else if (up) {
                    item.headWidth - stemWidth
                } else {
                    -(item.headWidth - stemWidth)
                }

            glyph(head, item.x + offset, y(position), item.id)

            pitch.accidental?.let {
                val mark = accidentalGlyph(it)
                glyph(mark, item.x - mark.width * scale - space * 0.25f, y(position), item.id)
            }

            for (dot in 0 until type.dots) {
                val dotPosition = if (position % 2 == 0) position + 1 else position
                glyph(MusicGlyph.Dot, item.x + item.headWidth + space * (0.4f + dot * 0.6f), y(dotPosition), item.id)
            }

            ledgerLines(position, item.x + offset, item.headWidth)
            previous = position
        }

        if (type.base >= 1 || beamUp != null) return

        val x = stemX(item, up)
        val outer = y(position((if (up) sorted.first() else sorted.last()).step))
        val end = stemEnd(item, up)

        add(NotationDrawing.Mark.Box(x - stemWidth / 2, min(outer, end), stemWidth, abs(end - outer)), item.id)

        val flag =
            when (flagCount(type.base)) {
                0 -> null
                1 -> if (up) MusicGlyph.EighthFlagUp else MusicGlyph.EighthFlagDown
                2 -> if (up) MusicGlyph.SixteenthFlagUp else MusicGlyph.SixteenthFlagDown
                else -> if (up) MusicGlyph.ThirtySecondFlagUp else MusicGlyph.ThirtySecondFlagDown
            }

        flag?.let { glyph(it, x - stemWidth / 2, end, item.id) }
    }

    private fun accidentalGlyph(accidental: AbcTune.Accidental): MusicGlyph =
        when (accidental) {
            AbcTune.Accidental.Sharp -> MusicGlyph.Sharp
            AbcTune.Accidental.Flat -> MusicGlyph.Flat
            AbcTune.Accidental.Natural -> MusicGlyph.Natural
            AbcTune.Accidental.DoubleSharp -> MusicGlyph.DoubleSharp
            AbcTune.Accidental.DoubleFlat -> MusicGlyph.DoubleFlat
        }

    private fun ledgerLines(
        position: Int,
        x: Float,
        width: Float,
    ) {
        val lines =
            when {
                position <= -2 -> -2 downTo position step 2
                position >= 10 -> 10..position step 2
                else -> IntRange.EMPTY
            }

        for (line in lines) {
            add(NotationDrawing.Mark.Box(x - space * 0.4f, y(line) - lineWidth / 2, width + space * 0.8f, lineWidth))
        }
    }

    private fun drawRest(item: Placed) {
        if (item.element.isInvisible) return

        if (item.element.fillsBar) {
            glyph(MusicGlyph.WholeRest, item.x, y(6), item.id)
            return
        }

        val type = noteType(item.element.written)
        val (rest, position) =
            when (type.base) {
                1.0 -> MusicGlyph.WholeRest to 6
                0.5 -> MusicGlyph.HalfRest to 4
                0.25 -> MusicGlyph.QuarterRest to 4
                0.125 -> MusicGlyph.EighthRest to 4
                0.0625 -> MusicGlyph.SixteenthRest to 4
                else -> MusicGlyph.ThirtySecondRest to 4
            }

        glyph(rest, item.x, y(position), item.id)

        for (dot in 0 until type.dots) {
            glyph(MusicGlyph.Dot, item.x + rest.width * scale + space * (0.4f + dot * 0.6f), y(5), item.id)
        }
    }

    /** Notes of an eighth or shorter, written together without a space, share beams. */
    private fun beamGroups(placed: List<Placed>): List<List<Int>> {
        val groups = mutableListOf<List<Int>>()
        var current = mutableListOf<Int>()

        placed.forEachIndexed { index, item ->
            val beamable = !item.element.isRest && flagCount(noteType(item.element.written).base) > 0

            if (!beamable || item.element.breaksBeam) {
                if (current.size > 1) groups += current
                current = mutableListOf()
            }

            if (beamable) current += index
        }

        if (current.size > 1) groups += current

        return groups
    }

    private fun drawBeamGroup(
        group: List<Placed>,
        up: Boolean,
    ) {
        val first = group.first()
        val last = group.last()
        val firstX = stemX(first, up)
        val lastX = stemX(last, up)
        var startY = stemEnd(first, up)
        var endY = stemEnd(last, up)
        val run = max(lastX - firstX, 1f)
        val maxSlope = space * 0.5f / max(run / space, 1f)
        val slope = ((endY - startY) / run).coerceIn(-maxSlope / space, maxSlope / space)
        endY = startY + slope * run

        val shortestStem = space * 2.5f

        for (item in group) {
            val positions = positions(item.element)
            val beamY = startY + slope * (stemX(item, up) - firstX)
            val move =
                if (up) {
                    min(y(positions.last()) - shortestStem - beamY, 0f)
                } else {
                    max(y(positions.first()) + shortestStem - beamY, 0f)
                }

            startY += move
            endY += move
        }

        val beamY = { x: Float -> startY + (endY - startY) * (x - firstX) / run }
        val inward = if (up) 1f else -1f

        for (item in group) {
            val x = stemX(item, up)
            val positions = positions(item.element)
            val outer = if (up) y(positions.first()) else y(positions.last())
            val end = beamY(x)
            add(NotationDrawing.Mark.Box(x - stemWidth / 2, min(outer, end), stemWidth, abs(end - outer)), item.id)
        }

        addBeam(firstX - stemWidth / 2, lastX + stemWidth / 2, 0, inward, beamY)

        // Second and third beams between neighbors that both have them, or a stub on a lone one.
        for (level in 1..2) {
            group.forEachIndexed { index, item ->
                if (flags(item) <= level) return@forEachIndexed

                val x = stemX(item, up)
                val next = group.getOrNull(index + 1)
                val nextHas = next != null && flags(next) > level
                val previousHas = group.getOrNull(index - 1)?.let { flags(it) > level } ?: false

                if (next != null && nextHas) {
                    addBeam(x - stemWidth / 2, stemX(next, up) + stemWidth / 2, level, inward, beamY)
                } else if (!previousHas) {
                    val toward = if (next == null) -space * 1.1f else space * 1.1f
                    addBeam(min(x, x + toward), max(x, x + toward), level, inward, beamY)
                }
            }
        }
    }

    private fun flags(item: Placed): Int = flagCount(noteType(item.element.written).base)

    private fun addBeam(
        startX: Float,
        endX: Float,
        level: Int,
        inward: Float,
        beamY: (Float) -> Float,
    ) {
        val offset = inward * level * space * 0.75f
        val thickness = inward * space * 0.5f

        add(
            NotationDrawing.Mark.Beam(
                listOf(
                    startX to beamY(startX) + offset,
                    endX to beamY(endX) + offset,
                    endX to beamY(endX) + offset + thickness,
                    startX to beamY(startX) + offset + thickness,
                ),
            ),
        )
    }

    /** A tie over the bar line reaches the note it holds in the next bar, or the end of the line when that note starts the next. */
    private fun drawPendingTies(toX: Float) {
        for ((item, pitch) in pendingTies) drawTie(item, pitch, toX)
        pendingTies.clear()
    }

    private fun drawTie(
        start: Placed,
        pitch: AbcTune.Pitch,
        toX: Float,
    ) {
        val direction = if (stemsUp(listOf(start.element))) 1f else -1f
        val baseY = y(position(pitch.step)) + direction * space * 0.6f

        add(
            NotationDrawing.Mark.Tie(
                fromX = start.x + start.headWidth + space * 0.2f,
                toX = toX,
                y = baseY,
                controlY = baseY + direction * space * 0.9f,
                width = max(space * 0.14f, 1f),
            ),
            start.id,
        )
    }

    /**
     * Each note's fret on the highest string that reaches it, as abcjs's guitar tab picks them; a chord's notes take one string
     * each, the highest note first. A note a tie holds isn't played again. The guitar reads an octave above how it sounds, so
     * the strings are E3 A3 D4 G4 B4 E5 here.
     */
    private fun drawTab(item: Placed) {
        val tabSpace = tabSpace ?: return
        val used = mutableSetOf<Int>()

        for (pitch in item.element.pitches.sortedByDescending { it.midi }) {
            if (pitch.continuesTie) continue

            val string = TAB_STRINGS.indices.lastOrNull { TAB_STRINGS[it] <= pitch.midi && it !in used }
            string?.let { used += it }

            val fret = string?.let { (pitch.midi - TAB_STRINGS[it]).toString() } ?: "?"
            val row = string?.let { TAB_STRINGS.lastIndex - it } ?: TAB_STRINGS.lastIndex
            val text =
                NotationDrawing.Mark.Text(
                    fret,
                    item.x + item.headWidth / 2,
                    tabTop + row * tabSpace,
                    NotationDrawing.TextKind.TabFret,
                )

            add(text, item.id)
        }
    }

    private fun add(
        mark: NotationDrawing.Mark,
        element: NotationElementId? = null,
    ) {
        items += NotationDrawing.Item(mark, element)
    }

    private fun extent(mark: NotationDrawing.Mark): Pair<Float, Float> =
        when (mark) {
            is NotationDrawing.Mark.Glyph -> {
                mark.y + mark.glyph.bounds.top * mark.scale to mark.y + mark.glyph.bounds.bottom * mark.scale
            }

            is NotationDrawing.Mark.Box -> {
                mark.top to mark.top + mark.height
            }

            is NotationDrawing.Mark.Beam -> {
                mark.points.minOf { it.second } to mark.points.maxOf { it.second }
            }

            is NotationDrawing.Mark.Bracket -> {
                mark.points.minOf { it.second } to mark.points.maxOf { it.second }
            }

            is NotationDrawing.Mark.Tie -> {
                val peak = (mark.y + mark.controlY) / 2
                min(mark.y, peak) to max(mark.y, peak)
            }

            is NotationDrawing.Mark.Text -> {
                val top =
                    when (mark.kind) {
                        NotationDrawing.TextKind.ChordSymbol -> mark.y - textHeight
                        NotationDrawing.TextKind.TabFret, NotationDrawing.TextKind.TupletNumber -> mark.y - textHeight / 2
                        NotationDrawing.TextKind.EndingNumber -> mark.y
                    }
                top to top + textHeight
            }
        }

    private companion object {
        /** abcjs's narrow staff: below it, two bars to a line instead of four. */
        const val WIDE_STAFF = 480f
        const val LINE_GAP = 2.5f
        val SHARP_POSITIONS = listOf(8, 5, 9, 6, 3, 7, 4)
        val FLAT_POSITIONS = listOf(4, 7, 3, 6, 2, 5, 1)
        val TAB_STRINGS = listOf(52, 57, 62, 67, 71, 76)
        val DIGITS =
            listOf(
                MusicGlyph.Digit0,
                MusicGlyph.Digit1,
                MusicGlyph.Digit2,
                MusicGlyph.Digit3,
                MusicGlyph.Digit4,
                MusicGlyph.Digit5,
                MusicGlyph.Digit6,
                MusicGlyph.Digit7,
                MusicGlyph.Digit8,
                MusicGlyph.Digit9,
            )
    }
}

internal data class NoteType(
    val base: Double,
    val dots: Int,
)

private val NOTE_BASES = listOf(1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125)

/** A written length as a note type and its dots: 3/8 is a dotted quarter. */
internal fun noteType(length: Double): NoteType {
    for (base in NOTE_BASES) {
        for (dots in 0..2) {
            if (abs(base * (2 - 0.5.pow(dots)) - length) < 1e-6) return NoteType(base, dots)
        }
    }

    return NoteType(NOTE_BASES.firstOrNull { it <= length + 1e-9 } ?: NOTE_BASES.last(), 0)
}

private fun head(base: Double): MusicGlyph =
    when {
        base >= 1 -> MusicGlyph.WholeNote
        base >= 0.5 -> MusicGlyph.HalfNote
        else -> MusicGlyph.BlackNote
    }

private fun flagCount(base: Double): Int =
    when {
        base <= 0.03125 -> 3
        base <= 0.0625 -> 2
        base <= 0.125 -> 1
        else -> 0
    }
