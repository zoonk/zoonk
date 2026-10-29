package com.zoonk.android.feature.activities

import kotlin.math.E
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.cbrt
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.log2
import kotlin.math.pow
import kotlin.math.sign
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/**
 * Core's safe formula evaluator (`expression/evaluate-expression.ts`): numbers, + - * / ^, unary
 * signs, parentheses, `pi`, `e`, its functions and the given variables. Null where core fails.
 */
object ActivityExpression {
    private const val MAX_LENGTH = 300
    private const val MAX_DEPTH = 32
    private const val MAX_ROUND_DIGITS = 10
    private const val HALF_TURN_DEGREES = 180.0

    private val tokenPattern = Regex("""(\s+)|((?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?)|([A-Z_a-z]\w*)|([(),*+/^-])|(.)""")

    private val constants = mapOf("e" to E, "pi" to PI)

    private class Function(
        val minArgs: Int,
        val maxArgs: Int,
        val apply: (List<Double>) -> Double,
    )

    private fun unary(apply: (Double) -> Double) = Function(1, 1) { apply(it[0]) }

    private val functions =
        mapOf(
            "abs" to unary(::abs),
            "acos" to unary(::acos),
            "asin" to unary(::asin),
            "atan" to unary(::atan),
            "cbrt" to unary(::cbrt),
            "ceil" to unary(::ceil),
            "cos" to unary(::cos),
            "deg" to unary { it * HALF_TURN_DEGREES / PI },
            "exp" to unary(::exp),
            "floor" to unary(::floor),
            "ln" to unary(::ln),
            "log" to unary(::ln),
            "log10" to unary(::log10),
            "log2" to unary(::log2),
            "max" to Function(1, Int.MAX_VALUE) { it.max() },
            "min" to Function(1, Int.MAX_VALUE) { it.min() },
            "rad" to unary { it * PI / HALF_TURN_DEGREES },
            "round" to Function(1, 2, ::roundTo),
            "sign" to unary(Double::sign),
            "sin" to unary(::sin),
            "sqrt" to unary(::sqrt),
            "tan" to unary(::tan),
        )

    private sealed interface Node {
        data class Number(
            val value: Double,
        ) : Node

        data class Constant(
            val value: Double,
        ) : Node

        data class Variable(
            val name: String,
        ) : Node

        data class Negate(
            val argument: Node,
        ) : Node

        data class Binary(
            val left: Node,
            val operator: Char,
            val right: Node,
        ) : Node

        data class Call(
            val function: Function,
            val args: List<Node>,
        ) : Node
    }

    private sealed interface Token {
        data class Number(
            val value: Double,
        ) : Token

        data class Identifier(
            val name: String,
        ) : Token

        data class Symbol(
            val symbol: Char,
        ) : Token

        data object End : Token
    }

    private class Invalid : Exception()

    fun evaluate(
        source: String,
        variables: Map<String, Double> = emptyMap(),
    ): Double? {
        val tree = parse(source) ?: return null
        return runCatching { evaluate(tree, variables) }.getOrNull()?.takeIf { it.isFinite() }
    }

    private fun parse(source: String): Node? {
        if (source.length > MAX_LENGTH) return null
        val tokens = tokenize(source) ?: return null
        return runCatching {
            val parser = Parser(tokens)
            parser.additive(0).also { if (parser.peek() != Token.End) throw Invalid() }
        }.getOrNull()
    }

    private fun tokenize(source: String): List<Token>? {
        val tokens = mutableListOf<Token>()
        for (match in tokenPattern.findAll(source)) {
            val (_, number, identifier, symbol, invalid) = match.destructured
            when {
                invalid.isNotEmpty() -> return null
                number.isNotEmpty() -> tokens += Token.Number(number.toDouble())
                identifier.isNotEmpty() -> tokens += Token.Identifier(identifier)
                symbol.isNotEmpty() -> tokens += Token.Symbol(symbol.single())
            }
        }
        return tokens + Token.End
    }

    private class Parser(
        private val tokens: List<Token>,
    ) {
        private var index = 0

        fun peek(): Token = tokens.getOrElse(index) { Token.End }

        private fun isSymbol(symbol: Char) = (peek() as? Token.Symbol)?.symbol == symbol

        private fun expect(symbol: Char) {
            if (!isSymbol(symbol)) throw Invalid()
            index++
        }

        fun additive(depth: Int): Node = binaryTail(multiplicative(depth), setOf('+', '-')) { multiplicative(depth) }

        private fun multiplicative(depth: Int): Node = binaryTail(unary(depth), setOf('*', '/')) { unary(depth) }

        private fun binaryTail(
            first: Node,
            operators: Set<Char>,
            next: () -> Node,
        ): Node {
            var left = first
            while (true) {
                val operator = (peek() as? Token.Symbol)?.symbol?.takeIf { it in operators } ?: return left
                index++
                left = Node.Binary(left, operator, next())
            }
        }

        private fun unary(depth: Int): Node {
            if (depth > MAX_DEPTH) throw Invalid()
            return when {
                isSymbol('+') -> {
                    index++
                    unary(depth + 1)
                }

                isSymbol('-') -> {
                    index++
                    Node.Negate(unary(depth + 1))
                }

                else -> {
                    power(depth)
                }
            }
        }

        private fun power(depth: Int): Node {
            val base = primary(depth)
            if (!isSymbol('^')) return base
            index++
            return Node.Binary(base, '^', unary(depth + 1))
        }

        private fun primary(depth: Int): Node =
            when (val token = peek()) {
                is Token.Number -> {
                    index++
                    Node.Number(token.value)
                }

                is Token.Identifier -> {
                    identifier(token.name, depth)
                }

                is Token.Symbol -> {
                    if (token.symbol != '(') throw Invalid()
                    index++
                    additive(depth + 1).also { expect(')') }
                }

                Token.End -> {
                    throw Invalid()
                }
            }

        private fun identifier(
            name: String,
            depth: Int,
        ): Node {
            index++
            val function = functions[name.lowercase()]
            if (!isSymbol('(')) {
                if (function != null) throw Invalid()
                return constants[name]?.let(Node::Constant) ?: Node.Variable(name)
            }
            if (function == null) throw Invalid()
            index++
            val args = mutableListOf<Node>()
            if (isSymbol(')')) {
                index++
            } else {
                while (true) {
                    args += additive(depth + 1)
                    if (isSymbol(',')) {
                        index++
                    } else {
                        expect(')')
                        break
                    }
                }
            }
            if (args.size !in function.minArgs..function.maxArgs) throw Invalid()
            return Node.Call(function, args)
        }
    }

    private fun evaluate(
        node: Node,
        variables: Map<String, Double>,
    ): Double {
        val value =
            when (node) {
                is Node.Number -> node.value
                is Node.Constant -> node.value
                is Node.Variable -> variables[node.name] ?: throw Invalid()
                is Node.Negate -> -evaluate(node.argument, variables)
                is Node.Call -> node.function.apply(node.args.map { evaluate(it, variables) })
                is Node.Binary -> applyOperator(node.operator, evaluate(node.left, variables), evaluate(node.right, variables))
            }
        if (!value.isFinite()) throw Invalid()
        return value
    }

    private fun applyOperator(
        operator: Char,
        left: Double,
        right: Double,
    ): Double =
        when (operator) {
            '+' -> left + right
            '-' -> left - right
            '*' -> left * right
            '/' -> left / right
            else -> left.pow(right)
        }

    private fun roundTo(args: List<Double>): Double {
        val digits = args.getOrElse(1) { 0.0 }
        if (digits != floor(digits) || digits < 0 || digits > MAX_ROUND_DIGITS) return Double.NaN
        val factor = 10.0.pow(digits)
        return jsRound(args[0] * factor) / factor
    }
}

/** JavaScript's `Math.round`: halves go up, so -2.5 rounds to -2. */
internal fun jsRound(value: Double): Double {
    if (!value.isFinite()) return value
    val whole = floor(value)
    return if (value - whole >= 0.5) whole + 1 else whole
}
