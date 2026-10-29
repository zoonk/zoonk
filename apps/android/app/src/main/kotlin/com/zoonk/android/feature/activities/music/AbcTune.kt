package com.zoonk.android.feature.activities.music

import kotlin.math.pow

/** Read the way abcjs reads it for main's notation player. Ornaments, grace notes, slurs, lyrics and other voices are read past and left out. */
data class AbcTune(
    val title: String? = null,
    val composer: String? = null,
    val meter: Meter = Meter.None,
    val clef: Clef = Clef.Treble,
    /** Sharps (positive) or flats (negative) in the key signature. */
    val fifths: Int = 0,
    val bars: List<Bar> = emptyList(),
) {
    enum class Clef { Treble, Bass }

    sealed interface Meter {
        data object None : Meter

        data object Common : Meter

        data object Cut : Meter

        data class Fraction(
            val num: Int,
            val den: Int,
        ) : Meter

        /** A tune without one counts in 4/4, as abcjs does. */
        val fraction: Fraction
            get() =
                when (this) {
                    None, Common -> Fraction(4, 4)
                    Cut -> Fraction(2, 2)
                    is Fraction -> this
                }

        /** The share of a whole note one beat lasts (abcjs's `getBeatLength`): a dotted quarter in 6/8, a quarter in 4/4. */
        val beatLength: Double
            get() {
                val (num, den) = fraction
                val multiplier =
                    when {
                        num in listOf(6, 9, 12) || (num == 3 && den == 8) -> 3
                        den == 8 && num in listOf(5, 7) -> 2
                        else -> 1
                    }
                return multiplier.toDouble() / den
            }
    }

    enum class Accidental(
        val semitones: Int,
    ) {
        Sharp(1),
        Flat(-1),
        Natural(0),
        DoubleSharp(2),
        DoubleFlat(-2),
    }

    data class Pitch(
        /** Letters from C0: C4 (middle C) is 28, E4 is 30. */
        val step: Int,
        val midi: Int,
        /** The accidental written before it; one from the key or an earlier note isn't drawn. */
        val accidental: Accidental?,
        /** Tied to the same note in the next chord or note, which rings on instead of being struck. */
        val isTied: Boolean = false,
        /** Rings on from the previous note's tie: no new sound. */
        val continuesTie: Boolean = false,
    )

    data class Tuplet(
        val number: Int,
        val count: Int,
    )

    data class Element(
        /** The notes struck together (one for a single note), or none for a rest. */
        val pitches: List<Pitch>,
        /** The length as drawn, in whole notes. */
        val written: Double,
        /** The length it lasts, in whole notes (a tuplet's notes are shorter than drawn). */
        val sounding: Double,
        val isInvisible: Boolean = false,
        /** A whole bar's rest (`Z`, `X`), drawn as a whole rest in the middle of the bar whatever the meter. */
        val fillsBar: Boolean = false,
        /** A space before it: its beam doesn't join the previous note's. */
        val breaksBeam: Boolean = false,
        val chordSymbol: String? = null,
        /** The number over a tuplet, on its first note, with how many notes it spans. */
        val tuplet: Tuplet? = null,
    ) {
        val isRest: Boolean get() = pitches.isEmpty()
    }

    enum class BarLine { Single, Double, Final, None }

    data class Bar(
        val elements: List<Element> = emptyList(),
        val startsRepeat: Boolean = false,
        val endsRepeat: Boolean = false,
        /** A first or second ending: played only on that pass through the repeat. */
        val ending: Int? = null,
        val end: BarLine = BarLine.None,
        /** A new key signature from this bar on (sharps positive, flats negative). */
        val fifths: Int? = null,
    )

    val hasMusic: Boolean get() = bars.any { it.elements.isNotEmpty() }

    /**
     * The order bars play in, repeats and endings followed: a repeat goes back to its `|:` (or to the first bar after the
     * last repeat), a first ending plays the first time and a second ending the second.
     */
    val playOrder: List<Int>
        get() {
            val order = mutableListOf<Int>()
            var index = 0
            var repeatStart = 0
            var repeatEnd = -1
            val repeated = mutableSetOf<Int>()
            var pass = 1

            while (index < bars.size) {
                val bar = bars[index]

                if (pass == 2 && bar.ending == null && index > repeatEnd) {
                    pass = 1
                    repeatStart = index
                }

                if (bar.startsRepeat && pass == 1) repeatStart = index

                if (bar.ending != null && bar.ending != pass) {
                    index += 1
                    continue
                }

                order += index

                if (bar.endsRepeat && repeated.add(index)) {
                    pass = 2
                    repeatEnd = index
                    index = repeatStart
                    continue
                }

                index += 1
            }

            return order
        }

    /** Each drawn bar's struck notes as MIDI numbers, for reading the tune aloud. */
    val outline: List<List<Int>>
        get() {
            val lastWithNotes = bars.indexOfLast { it.elements.isNotEmpty() }
            return bars.take(lastWithNotes + 1).map { bar ->
                bar.elements.flatMap { element -> element.pitches.filterNot { it.continuesTie }.map { it.midi } }
            }
        }

    companion object {
        fun parse(notation: String): AbcTune = AbcReader().read(notation)
    }
}

/** A header field the way main reads it: the first line starting with `T:` (or another letter), trimmed, or null when empty. */
private fun header(
    field: Char,
    notation: String,
): String? =
    notation
        .lines()
        .firstOrNull { it.startsWith("$field:") }
        ?.drop(2)
        ?.trim()
        ?.ifEmpty { null }

private class AbcReader {
    private var meter: AbcTune.Meter = AbcTune.Meter.None
    private var clef = AbcTune.Clef.Treble
    private var fifths = 0
    private val bars = mutableListOf<AbcTune.Bar>()
    private var bar = AbcTune.Bar()
    private val elements = mutableListOf<AbcTune.Element>()

    private var unitLength: Double? = null
    private var keyAccidentals = mapOf<Char, Int>()
    private val barAccidentals = mutableMapOf<Int, Int>()
    private var pendingEnding: Int? = null
    private var breaksBeam = false
    private var chordSymbol: String? = null
    private var tuplet: TupletState? = null
    private var broken: Double? = null
    private var tiedMidis = setOf<Int>()
    private var inBody = false
    private var voices = 0

    private class TupletState(
        val number: Int,
        val count: Int,
        val left: Int,
        val factor: Double,
    )

    fun read(notation: String): AbcTune {
        for (rawLine in notation.lines()) {
            val line = rawLine.substringBefore('%')
            val field = fieldLine(line)

            if (field != null) {
                readField(field.first, field.second)
            } else if (inBody && voices <= 1) {
                readBody(line)
                breaksBeam = true
            }
        }

        if (elements.isNotEmpty() || bar.startsRepeat) bars += bar.copy(elements = elements.toList())

        return AbcTune(
            title = header('T', notation),
            composer = header('C', notation),
            meter = meter,
            clef = clef,
            fifths = fifths,
            bars = bars.toList(),
        )
    }

    private fun fieldLine(line: String): Pair<Char, String>? =
        if (line.length >= 2 && line[0].isLetter() && line[1] == ':') line[0] to line.drop(2).trim() else null

    /** Whether notes were read yet: later key and meter fields change only what follows. */
    private val hasMusic: Boolean get() = bars.isNotEmpty() || elements.isNotEmpty()

    private fun readField(
        field: Char,
        value: String,
    ) {
        when (field) {
            // The tune keeps its first meter: its beat sets the tempo of the whole melody.
            'M' -> {
                if (!hasMusic) meter = readMeter(value)
            }

            'L' -> {
                unitLength = readFraction(value)
            }

            'K' -> {
                readKey(value)
                inBody = true
            }

            'V' -> {
                voices += 1
            }
        }
    }

    private fun parts(value: String): List<String> = value.split('/').map { it.trim() }.filter { it.isNotEmpty() }

    private fun readMeter(value: String): AbcTune.Meter =
        when (value.trim()) {
            "C" -> {
                AbcTune.Meter.Common
            }

            "C|" -> {
                AbcTune.Meter.Cut
            }

            "", "none" -> {
                AbcTune.Meter.None
            }

            else -> {
                val numbers = parts(value).mapNotNull { it.toIntOrNull() }
                if (numbers.size == 2 && numbers[1] > 0) AbcTune.Meter.Fraction(numbers[0], numbers[1]) else AbcTune.Meter.None
            }
        }

    private fun readFraction(value: String): Double? {
        val numbers = parts(value).mapNotNull { it.toDoubleOrNull() }
        return if (numbers.size == 2 && numbers[1] > 0) numbers[0] / numbers[1] else null
    }

    /** The unit note length: L: when given, else an eighth (a sixteenth in meters under 3/4). */
    private val unit: Double
        get() {
            unitLength?.let { return it }
            val written = meter as? AbcTune.Meter.Fraction
            return if (written != null && written.num.toDouble() / written.den < 0.75) 1.0 / 16 else 1.0 / 8
        }

    private fun readKey(value: String) {
        val words = value.split(' ').filter { it.isNotEmpty() }
        var signature = 0
        val extras = mutableMapOf<Char, Int>()
        var rest = words
        val first = words.firstOrNull()
        val tonic = first?.firstOrNull()

        if (first != null && tonic != null && tonic in LETTERS) {
            rest = words.drop(1)
            var mode = first.drop(1)
            var shift = 0

            if (mode.startsWith('#')) {
                shift = 7
                mode = mode.drop(1)
            } else if (mode.startsWith('b')) {
                shift = -7
                mode = mode.drop(1)
            }

            var modeName = mode.lowercase()
            val next = rest.firstOrNull()

            if (modeName.isEmpty() && next != null && next.first().isLetter() && '=' !in next) {
                val word = next.lowercase()

                if (MODE_SHIFTS.any { word.startsWith(it.first) }) {
                    modeName = word
                    rest = rest.drop(1)
                }
            }

            signature = TONIC_FIFTHS.getValue(tonic) + shift + (MODE_SHIFTS.firstOrNull { modeName.startsWith(it.first) }?.second ?: 0)
        }

        for (word in rest) {
            val lowered = word.lowercase()

            when {
                lowered == "bass" || lowered.startsWith("clef=bass") -> if (!hasMusic) clef = AbcTune.Clef.Bass
                lowered == "treble" || lowered.startsWith("clef=treble") -> if (!hasMusic) clef = AbcTune.Clef.Treble
                else -> explicitAccidental(word)?.let { extras[it.first] = it.second }
            }
        }

        val clamped = signature.coerceIn(-7, 7)

        if (hasMusic) bar = bar.copy(fifths = clamped) else fifths = clamped

        keyAccidentals =
            "FCGDAEB".take(maxOf(clamped, 0)).associateWith { 1 } +
            "BEADGCF".take(maxOf(-clamped, 0)).associateWith { -1 } +
            extras
    }

    private fun explicitAccidental(word: String): Pair<Char, Int>? {
        if (word.length != 2) return null
        val letter = word[1].uppercaseChar().takeIf { it in LETTERS } ?: return null

        return when (word[0]) {
            '^' -> letter to 1
            '_' -> letter to -1
            '=' -> letter to 0
            else -> null
        }
    }

    private fun readBody(characters: String) {
        var index = 0

        while (index < characters.length) {
            val character = characters[index]

            index =
                when (character) {
                    ' ', '\t' -> {
                        breaksBeam = true
                        index + 1
                    }

                    '|', ':' -> {
                        readBarLine(characters, index)
                    }

                    '[' -> {
                        readBracket(characters, index)
                    }

                    '"' -> {
                        readQuoted(characters, index)
                    }

                    '!', '+' -> {
                        skip(characters, index + 1, character)
                    }

                    '{' -> {
                        skip(characters, index + 1, '}')
                    }

                    '(' -> {
                        readTuplet(characters, index)
                    }

                    '-' -> {
                        tieLast()
                        index + 1
                    }

                    '>', '<' -> {
                        readBroken(characters, index)
                    }

                    'z', 'x', 'Z', 'X' -> {
                        readRest(characters, index)
                    }

                    '^', '_', '=', in 'A'..'G', in 'a'..'g' -> {
                        readNoteElement(characters, index)
                    }

                    // Slur ends, decorations (. ~ H L M O P S T u v), spacers and line continuations.
                    else -> {
                        index + 1
                    }
                }
        }
    }

    private fun tieLast() {
        val last = elements.lastOrNull() ?: return
        elements[elements.lastIndex] = last.copy(pitches = last.pitches.map { it.copy(isTied = true) })
        tiedMidis = last.pitches.map { it.midi }.toSet()
    }

    private fun skip(
        characters: String,
        start: Int,
        until: Char,
    ): Int {
        var index = start
        while (index < characters.length && characters[index] != until) index += 1
        return index + 1
    }

    private fun readQuoted(
        characters: String,
        start: Int,
    ): Int {
        val end = skip(characters, start + 1, '"')
        val text = characters.substring(start + 1, minOf(end - 1, characters.length))
        val first = text.firstOrNull()

        if (first != null && first !in "^_<>@") chordSymbol = text

        return end
    }

    private fun readTuplet(
        characters: String,
        start: Int,
    ): Int {
        var index = start + 1
        val numbers = mutableListOf<Int?>()

        while (numbers.size < 3) {
            val digits = characters.drop(index).takeWhile { it.isDigit() }
            index += digits.length

            // A slur.
            if (digits.isEmpty() && numbers.isEmpty()) return start + 1

            numbers += digits.toIntOrNull()

            if (characters.getOrNull(index) != ':') break

            index += 1
        }

        val notes = numbers.first()

        if (notes == null || notes <= 1 || numbers.drop(1).filterNotNull().any { it <= 0 }) return index

        val written = meter as? AbcTune.Meter.Fraction
        val compound = written != null && written.num % 3 == 0 && written.num > 3
        val defaultTime = TUPLET_TIMES[notes] ?: if (compound) 3 else 2
        val time = numbers.getOrNull(1) ?: defaultTime
        val count = numbers.getOrNull(2) ?: notes

        tuplet = TupletState(notes, count, count, time.toDouble() / notes)
        return index
    }

    private fun readBroken(
        characters: String,
        start: Int,
    ): Int {
        val symbol = characters[start]
        val dots = characters.drop(start).takeWhile { it == symbol }.length
        val short = 0.5.pow(dots)
        val long = 2 - short
        val last = elements.lastOrNull()

        if (last != null) {
            val factor = if (symbol == '>') long else short
            elements[elements.lastIndex] = last.copy(written = last.written * factor, sounding = last.sounding * factor)
        }

        broken = if (symbol == '>') short else long
        return start + dots
    }

    /** A bar line (`|`, `||`, `|]`, `[|`, `|:`, `:|`, `::`), maybe with an ending number after it. */
    private fun readBarLine(
        characters: String,
        start: Int,
    ): Int {
        var index = start
        val symbol = StringBuilder()

        while (index < characters.length && characters[index] in "|:[]") {
            val next = characters.getOrNull(index + 1)

            if (characters[index] == '[' && next != null && next != '|' && !next.isDigit()) break

            symbol.append(characters[index])
            index += 1
        }

        val ending = characters.getOrNull(index)?.digitToIntOrNull()

        if (ending != null) index += 1

        val written = symbol.toString()

        if ('|' !in written && written != "::") return maxOf(index, start + 1)

        val endsRepeat = written.startsWith(':')
        val line =
            when {
                "||" in written -> AbcTune.BarLine.Double
                "|]" in written || "[|" in written -> AbcTune.BarLine.Final
                else -> AbcTune.BarLine.Single
            }

        finishBar(line, endsRepeat)
        bar = bar.copy(startsRepeat = written.endsWith(':'))

        if (ending != null) {
            pendingEnding = ending
            bar = bar.copy(ending = ending)
        }

        return index
    }

    private fun finishBar(
        line: AbcTune.BarLine,
        endsRepeat: Boolean,
    ) {
        if (elements.isNotEmpty()) {
            bars += bar.copy(elements = elements.toList(), end = line, endsRepeat = endsRepeat)
        } else if (bars.isNotEmpty()) {
            // A bar line right after another only restyles it, like `| |]`.
            val last = bars.last()
            bars[bars.lastIndex] = last.copy(end = line, endsRepeat = last.endsRepeat || endsRepeat)
        }

        // A first ending runs on until its repeat; any other ending is one bar long.
        val continuesEnding = pendingEnding.takeIf { it == 1 && !endsRepeat && line == AbcTune.BarLine.Single }
        elements.clear()
        bar = AbcTune.Bar(ending = continuesEnding)
        pendingEnding = continuesEnding
        barAccidentals.clear()
        breaksBeam = true
    }

    /** `[` opens a chord, an inline field (`[K:G]`) or an ending (`[1`). */
    private fun readBracket(
        characters: String,
        start: Int,
    ): Int {
        val next = characters.getOrNull(start + 1) ?: ' '

        next.digitToIntOrNull()?.let { ending ->
            pendingEnding = ending
            bar = bar.copy(ending = ending)
            return start + 2
        }

        if (next == '|') return readBarLine(characters, start)

        if (next.isLetter() && characters.getOrNull(start + 2) == ':') {
            val end = skip(characters, start, ']')
            readField(next, characters.substring(start + 3, maxOf(start + 3, minOf(end - 1, characters.length))).trim())
            return end
        }

        var index = start + 1
        val pitches = mutableListOf<AbcTune.Pitch>()
        var firstLength: Double? = null

        while (index < characters.length && characters[index] != ']') {
            val read = readPitch(characters, index)

            if (read == null) {
                index += 1
                continue
            }

            var pitch = read.pitch
            index = read.end

            if (characters.getOrNull(index) == '-') {
                pitch = pitch.copy(isTied = true)
                index += 1
            }

            pitches += pitch
            firstLength = firstLength ?: read.length
        }

        val length = length(characters, index + 1)
        addElement(pitches, (firstLength ?: 1.0) * length.value)
        return length.end
    }

    private fun readRest(
        characters: String,
        start: Int,
    ): Int {
        val symbol = characters[start]
        val length = length(characters, start + 1)
        val (num, den) = meter.fraction
        val barUnits = num.toDouble() / den / unit
        val units = if (symbol == 'Z' || symbol == 'X') barUnits * length.value else length.value

        addElement(emptyList(), units, isInvisible = symbol == 'x' || symbol == 'X', fillsBar = symbol == 'Z' || symbol == 'X')
        return length.end
    }

    private fun readNoteElement(
        characters: String,
        start: Int,
    ): Int {
        val read = readPitch(characters, start) ?: return start + 1
        addElement(listOf(read.pitch), read.length)
        return read.end
    }

    private class ReadPitch(
        val pitch: AbcTune.Pitch,
        val length: Double,
        val end: Int,
    )

    /** A note with its accidental, octave marks and length: `^f'3/2`. */
    private fun readPitch(
        characters: String,
        start: Int,
    ): ReadPitch? {
        val accidental = WRITTEN_ACCIDENTALS.firstOrNull { characters.startsWith(it.first, start) }
        var index = start + (accidental?.first?.length ?: 0)
        val character = characters.getOrNull(index) ?: return null
        val letter = LETTERS.indexOf(character.uppercaseChar()).takeIf { it >= 0 } ?: return null
        var octave = if (character.isLowerCase()) 5 else 4
        index += 1

        while (index < characters.length && (characters[index] == '\'' || characters[index] == ',')) {
            octave += if (characters[index] == '\'') 1 else -1
            index += 1
        }

        val step = octave * 7 + letter

        accidental?.let { barAccidentals[step] = it.second.semitones }

        val shift = barAccidentals[step] ?: keyAccidentals[LETTERS[letter]] ?: 0
        val midi = (octave + 1) * 12 + LETTER_SEMITONES[letter] + shift
        val length = length(characters, index)

        return ReadPitch(AbcTune.Pitch(step, midi, accidental?.second), length.value, length.end)
    }

    private class Length(
        val value: Double,
        val end: Int,
    )

    /** A length after a note: `2`, `/2`, `/`, `3/2`, `//`, as a multiple of the unit. */
    private fun length(
        characters: String,
        start: Int,
    ): Length {
        val digits = characters.drop(start).takeWhile { it.isDigit() }
        var index = start + digits.length
        var value = digits.toDoubleOrNull() ?: 1.0

        while (characters.getOrNull(index) == '/') {
            val divisor = characters.drop(index + 1).takeWhile { it.isDigit() }
            index += 1 + divisor.length
            // A zero (`C/0`) isn't a length: it's read past.
            value /= if (divisor.isEmpty()) 2.0 else divisor.toDouble().takeIf { it > 0 } ?: 1.0
        }

        return Length(value, index)
    }

    private fun addElement(
        pitches: List<AbcTune.Pitch>,
        length: Double,
        isInvisible: Boolean = false,
        fillsBar: Boolean = false,
    ) {
        var written = length * unit

        broken?.let {
            written *= it
            broken = null
        }

        var sounding = written
        var tupletMark: AbcTune.Tuplet? = null

        tuplet?.let { current ->
            sounding *= current.factor
            if (current.left == current.count) tupletMark = AbcTune.Tuplet(current.number, current.count)
            tuplet = if (current.left > 1) TupletState(current.number, current.count, current.left - 1, current.factor) else null
        }

        val tied = pitches.map { if (it.midi in tiedMidis) it.copy(continuesTie = true) else it }

        // A chord's own ties (`[C-EG]`) carry to the next note; a tie after it is read later.
        tiedMidis = tied.filter { it.isTied }.map { it.midi }.toSet()

        elements +=
            AbcTune.Element(
                pitches = tied,
                written = written,
                sounding = sounding,
                isInvisible = isInvisible,
                fillsBar = fillsBar,
                breaksBeam = breaksBeam,
                chordSymbol = chordSymbol,
                tuplet = tupletMark,
            )
        breaksBeam = false
        chordSymbol = null
    }

    private companion object {
        const val LETTERS = "CDEFGAB"
        val LETTER_SEMITONES = listOf(0, 2, 4, 5, 7, 9, 11)
        val TONIC_FIFTHS = mapOf('C' to 0, 'G' to 1, 'D' to 2, 'A' to 3, 'E' to 4, 'B' to 5, 'F' to -1)
        val MODE_SHIFTS =
            listOf(
                "maj" to 0,
                "ion" to 0,
                "min" to -3,
                "aeo" to -3,
                "dor" to -2,
                "phr" to -4,
                "lyd" to 1,
                "mix" to -1,
                "loc" to -5,
                "m" to -3,
            )
        val TUPLET_TIMES = mapOf(2 to 3, 3 to 2, 4 to 3, 6 to 2, 8 to 3)
        val WRITTEN_ACCIDENTALS =
            listOf(
                "^^" to AbcTune.Accidental.DoubleSharp,
                "__" to AbcTune.Accidental.DoubleFlat,
                "^" to AbcTune.Accidental.Sharp,
                "_" to AbcTune.Accidental.Flat,
                "=" to AbcTune.Accidental.Natural,
            )
    }
}
