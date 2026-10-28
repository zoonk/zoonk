package com.zoonk.android.ui.richtext

import android.content.res.Resources
import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.BaselineShift
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.em
import com.zoonk.android.R

/**
 * The words a screen reader says for a formula's structure, in the learner's language: main's
 * KaTeX draws MathML, which screen readers read as "x squared" or "a over b".
 */
@Immutable
internal data class MathWords(
    val squared: String,
    val cubed: String,
    val power: (exponent: String) -> String,
    val subscript: (index: String) -> String,
    val fraction: (numerator: String, denominator: String) -> String,
    val root: (radicand: String) -> String,
) {
    companion object {
        fun from(resources: Resources): MathWords =
            MathWords(
                squared = resources.getString(R.string.richtext_math_squared),
                cubed = resources.getString(R.string.richtext_math_cubed),
                power = { resources.getString(R.string.richtext_math_power, it) },
                subscript = { resources.getString(R.string.richtext_math_subscript, it) },
                fraction = { numerator, denominator -> resources.getString(R.string.richtext_math_fraction, numerator, denominator) },
                root = { resources.getString(R.string.richtext_math_root, it) },
            )
    }
}

internal data class TypesetMath(
    val text: AnnotatedString,
    val spoken: String,
)

/**
 * Some structured AI responses include JSON-escaped LaTeX commands as literal learner text, such
 * as `\\rightarrow`; main accepts that over-escaped shape, so this does too.
 */
private val OVER_ESCAPED_COMMAND = Regex("\\\\\\\\[A-Za-z]+")
private val SPACES = Regex("\\s+")

/**
 * Main draws LaTeX with KaTeX; this sets it as text, as Apple's `LessonMath` does, so it wraps and
 * scales with the font size, and TalkBack reads `spoken`.
 */
internal fun typesetMath(
    latex: String,
    words: MathWords,
): TypesetMath {
    val source = latex.replace(OVER_ESCAPED_COMMAND) { it.value.substring(1) }
    val piece = MathParser(source, words).parse(until = null, style = Script.Normal)
    return TypesetMath(piece.text, piece.spoken.trim().replace(SPACES, " "))
}

private enum class Script { Normal, Superscript, Subscript }

private data class Piece(
    val text: AnnotatedString,
    val spoken: String,
) {
    operator fun plus(other: Piece): Piece = Piece(text + other.text, spoken + other.spoken)

    val plain: String get() = text.text

    companion object {
        val Empty = Piece(AnnotatedString(""), "")
    }
}

/** A thin gap around relations and operators, as KaTeX spaces `=` and `+`. */
private const val OPERATOR_GAP = "\u2005"

private const val FUNCTION_GAP = "\u2006"

private class MathParser(
    private val source: String,
    private val words: MathWords,
) {
    private var index = 0

    fun parse(
        until: Char?,
        style: Script,
    ): Piece {
        var result = Piece.Empty

        while (index < source.length) {
            val character = source[index]

            if (character == until) {
                index++
                return result
            }

            result +=
                when (character) {
                    '\\' -> {
                        spaced(command(style), result, style)
                    }

                    '{' -> {
                        index++
                        parse(until = '}', style = style)
                    }

                    '^', '_' -> {
                        index++
                        script(if (character == '^') Script.Superscript else Script.Subscript)
                    }

                    ' ', '&', '\n', '\t' -> {
                        index++
                        Piece.Empty
                    }

                    '~' -> {
                        index++
                        run(" ", style, italic = false)
                    }

                    else -> {
                        index++
                        val text = if (character == '-') "\u2212" else character.toString()
                        spaced(run(text, style, italic = character.isLetter()), result, style)
                    }
                }
        }

        return result
    }

    /**
     * A relation or operator, set apart by a gap (not in an exponent or index). A sign that starts
     * an expression or follows an operator, a bracket or a comma stays with its number: `−3`.
     */
    private fun spaced(
        piece: Piece,
        result: Piece,
        style: Script,
    ): Piece {
        val text = piece.plain
        val isBinary = text in BINARY_OPERATORS

        if (style != Script.Normal || !(isBinary || text in RELATIONS)) return piece

        val last = result.plain.lastOrNull()
        if (isBinary && (last == null || last in "$OPERATOR_GAP([{,")) return piece

        val gap = Piece(AnnotatedString(OPERATOR_GAP), " ")
        return gap + piece + gap
    }

    private fun script(style: Script): Piece {
        val piece = scriptArgument(style)
        val said = piece.spoken.trim()

        val spoken =
            when {
                said.isEmpty() || said in ATTACHED_MARKS -> said
                style == Script.Subscript -> " ${words.subscript(said)} "
                said == "2" -> " ${words.squared} "
                said == "3" -> " ${words.cubed} "
                else -> " ${words.power(said)} "
            }

        return Piece(piece.text, spoken)
    }

    private fun scriptArgument(style: Script): Piece {
        if (index >= source.length) return Piece.Empty

        val character = source[index]

        if (character == '{') {
            index++
            return parse(until = '}', style = style)
        }

        if (character == '\\') return command(style)

        index++
        return run(if (character == '-') "\u2212" else character.toString(), style, italic = character.isLetter())
    }

    private fun argument(style: Script): Piece {
        while (index < source.length && source[index] == ' ') index++
        return scriptArgument(style)
    }

    private fun textArgument(): String {
        while (index < source.length && source[index] == ' ') index++
        if (index >= source.length || source[index] != '{') return ""

        index++
        var depth = 1
        val text = StringBuilder()

        while (index < source.length) {
            val character = source[index++]

            if (character == '{') {
                depth++
            } else if (character == '}') {
                depth--
                if (depth == 0) break
            }

            text.append(character)
        }

        return text.toString().replace("\\", "")
    }

    private fun command(style: Script): Piece {
        index++
        val start = index
        while (index < source.length && source[index].isLetter()) index++
        val name = source.substring(start, index)

        if (name.isEmpty()) {
            if (index >= source.length) return Piece.Empty
            val character = source[index++]

            return when (character) {
                '!' -> Piece.Empty
                ',', ';', ':', ' ', '\\' -> run(" ", style, italic = false)
                else -> run(character.toString(), style, italic = false)
            }
        }

        return when (name) {
            "text", "mathrm", "textrm", "operatorname", "mbox", "textnormal" -> {
                run(textArgument(), style, italic = false)
            }

            "mathit", "textit", "emph" -> {
                styled(argument(style), SpanStyle(fontStyle = FontStyle.Italic))
            }

            "mathbf", "textbf", "boldsymbol", "bm" -> {
                styled(argument(style), SpanStyle(fontWeight = FontWeight.Bold))
            }

            "mathbb" -> {
                val letters = textArgument()
                run(letters.map { DOUBLE_STRUCK[it] ?: it }.joinToString(""), style, italic = false)
            }

            "mathcal", "mathsf", "mathtt", "mathscr" -> {
                argument(style)
            }

            "frac", "dfrac", "tfrac" -> {
                val numerator = argument(Script.Superscript)
                val denominator = argument(Script.Subscript)
                val slash = run("\u2044", style, italic = false)
                Piece(
                    (numerator + slash + denominator).text,
                    " ${words.fraction(numerator.spoken.trim(), denominator.spoken.trim())} ",
                )
            }

            "sqrt" -> {
                val radicand = argument(style)
                val open = run("√", style, italic = false)
                val text =
                    if (radicand.plain.length > 1) {
                        open + run("(", style, italic = false) + radicand + run(")", style, italic = false)
                    } else {
                        open + radicand
                    }
                Piece(text.text, " ${words.root(radicand.spoken.trim())} ")
            }

            "vec", "hat", "bar", "overline", "dot", "tilde", "widehat", "overrightarrow" -> {
                accented(argument(style), ACCENTS.getValue(name))
            }

            "begin", "end" -> {
                textArgument()
                Piece.Empty
            }

            "left", "right", "big", "Big", "bigl", "bigr", "Bigl", "Bigr", "displaystyle", "textstyle", "limits" -> {
                Piece.Empty
            }

            "quad", "qquad" -> {
                run("  ", style, italic = false)
            }

            in FUNCTIONS -> {
                val next = source.drop(index).trimStart().firstOrNull()
                val gap = if (next != null && (next.isLetterOrDigit() || next == '\\')) FUNCTION_GAP else ""
                run(name + gap, style, italic = false)
            }

            else -> {
                run(SYMBOLS[name] ?: name, style, italic = false)
            }
        }
    }

    private fun run(
        text: String,
        style: Script,
        italic: Boolean,
    ): Piece {
        val span =
            when (style) {
                Script.Normal -> SpanStyle(fontStyle = if (italic) FontStyle.Italic else null)
                Script.Superscript -> scriptStyle(BaselineShift.Superscript, italic)
                Script.Subscript -> scriptStyle(BaselineShift.Subscript, italic)
            }

        return Piece(buildAnnotatedString { withStyle(span) { append(text) } }, SPOKEN_SYMBOLS[text] ?: text)
    }

    private fun scriptStyle(
        shift: BaselineShift,
        italic: Boolean,
    ) = SpanStyle(
        fontSize = SCRIPT_SIZE.em,
        baselineShift = shift,
        fontStyle = if (italic) FontStyle.Italic else null,
    )

    private fun styled(
        piece: Piece,
        style: SpanStyle,
    ): Piece = Piece(buildAnnotatedString { withStyle(style) { append(piece.text) } }, piece.spoken)

    private fun accented(
        piece: Piece,
        accent: Char,
    ): Piece {
        val text =
            buildAnnotatedString {
                piece.text.text.forEach { character ->
                    append(character)
                    append(accent)
                }
                piece.text.spanStyles.forEach { addStyle(it.item, it.start * 2, it.end * 2) }
            }

        return Piece(text, piece.spoken)
    }

    companion object {
        const val SCRIPT_SIZE = 0.7f

        val RELATIONS =
            setOf(
                "=",
                "<",
                ">",
                "≤",
                "≥",
                "≠",
                "≈",
                "≡",
                "∼",
                "≃",
                "≅",
                "∝",
                "→",
                "←",
                "↔",
                "⇒",
                "⇐",
                "⇔",
                "↦",
                "∈",
                "∉",
                "⊂",
                "⊆",
                "≪",
                "≫",
                "⩽",
                "⩾",
            )

        val BINARY_OPERATORS = setOf("+", "\u2212", "×", "÷", "·", "±", "∓", "∪", "∩", "∗", "⋆")

        /** Marks an exponent attaches to its base, said as themselves ("90°", "f′"). */
        val ATTACHED_MARKS = setOf("°", "′", "″", "∗", "*")

        val SPOKEN_SYMBOLS = mapOf("·" to "×")

        val FUNCTIONS =
            setOf(
                "log",
                "ln",
                "lg",
                "sin",
                "cos",
                "tan",
                "sec",
                "csc",
                "cot",
                "arcsin",
                "arccos",
                "arctan",
                "sinh",
                "cosh",
                "tanh",
                "exp",
                "min",
                "max",
                "lim",
                "det",
                "gcd",
                "deg",
                "sup",
                "inf",
                "arg",
            )

        val ACCENTS =
            mapOf(
                "vec" to '\u20D7',
                "overrightarrow" to '\u20D7',
                "hat" to '\u0302',
                "widehat" to '\u0302',
                "bar" to '\u0304',
                "overline" to '\u0305',
                "dot" to '\u0307',
                "tilde" to '\u0303',
            )

        val DOUBLE_STRUCK = mapOf('R' to 'ℝ', 'N' to 'ℕ', 'Z' to 'ℤ', 'Q' to 'ℚ', 'C' to 'ℂ')

        val SYMBOLS =
            mapOf(
                "times" to "×",
                "cdot" to "·",
                "cdotp" to "·",
                "div" to "÷",
                "pm" to "±",
                "mp" to "∓",
                "ast" to "∗",
                "star" to "⋆",
                "leq" to "≤",
                "le" to "≤",
                "leqslant" to "⩽",
                "geq" to "≥",
                "ge" to "≥",
                "geqslant" to "⩾",
                "lt" to "<",
                "gt" to ">",
                "neq" to "≠",
                "ne" to "≠",
                "approx" to "≈",
                "equiv" to "≡",
                "sim" to "∼",
                "simeq" to "≃",
                "cong" to "≅",
                "propto" to "∝",
                "ll" to "≪",
                "gg" to "≫",
                "infty" to "∞",
                "to" to "→",
                "rightarrow" to "→",
                "leftarrow" to "←",
                "leftrightarrow" to "↔",
                "uparrow" to "↑",
                "downarrow" to "↓",
                "mapsto" to "↦",
                "Rightarrow" to "⇒",
                "Leftarrow" to "⇐",
                "Leftrightarrow" to "⇔",
                "implies" to "⇒",
                "iff" to "⇔",
                "sum" to "∑",
                "prod" to "∏",
                "int" to "∫",
                "oint" to "∮",
                "partial" to "∂",
                "nabla" to "∇",
                "circ" to "°",
                "degree" to "°",
                "angle" to "∠",
                "triangle" to "△",
                "square" to "□",
                "perp" to "⊥",
                "parallel" to "∥",
                "mid" to "∣",
                "in" to "∈",
                "notin" to "∉",
                "subset" to "⊂",
                "subseteq" to "⊆",
                "cup" to "∪",
                "cap" to "∩",
                "emptyset" to "∅",
                "varnothing" to "∅",
                "forall" to "∀",
                "exists" to "∃",
                "neg" to "¬",
                "land" to "∧",
                "lor" to "∨",
                "ldots" to "…",
                "cdots" to "⋯",
                "dots" to "…",
                "colon" to ":",
                "percent" to "%",
                "prime" to "′",
                "checkmark" to "✓",
                "ell" to "ℓ",
                "hbar" to "ℏ",
                "alpha" to "α",
                "beta" to "β",
                "gamma" to "γ",
                "delta" to "δ",
                "epsilon" to "ε",
                "varepsilon" to "ε",
                "zeta" to "ζ",
                "eta" to "η",
                "theta" to "θ",
                "vartheta" to "ϑ",
                "iota" to "ι",
                "kappa" to "κ",
                "lambda" to "λ",
                "mu" to "μ",
                "nu" to "ν",
                "xi" to "ξ",
                "pi" to "π",
                "rho" to "ρ",
                "varrho" to "ϱ",
                "sigma" to "σ",
                "tau" to "τ",
                "upsilon" to "υ",
                "phi" to "φ",
                "varphi" to "φ",
                "chi" to "χ",
                "psi" to "ψ",
                "omega" to "ω",
                "Gamma" to "Γ",
                "Delta" to "Δ",
                "Theta" to "Θ",
                "Lambda" to "Λ",
                "Xi" to "Ξ",
                "Pi" to "Π",
                "Sigma" to "Σ",
                "Upsilon" to "Υ",
                "Phi" to "Φ",
                "Psi" to "Ψ",
                "Omega" to "Ω",
            )
    }
}
