package com.zoonk.android.feature.activities.geometry

import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.ActivityExpectedAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf5
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf5AtomsInner
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf5BondsInner
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sin
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf5Value as MoleculeAnswerValue

internal data class BuildAtom(
    val element: String,
    val id: String,
)

internal data class BuildBond(
    val from: String,
    val order: Int,
    val to: String,
)

internal data class MoleculeBuild(
    val atoms: List<BuildAtom> = emptyList(),
    val bonds: List<BuildBond> = emptyList(),
)

internal enum class AtomFill { Open, Full, Over }

/** The build as the learner's answer; nothing built is no answer. */
internal fun moleculeAnswer(build: MoleculeBuild): ActivityAnswer? =
    build.takeIf { it.atoms.isNotEmpty() }?.let {
        MoleculeAnswerValue(
            LessonStepAnswerOneOf3AnswerOneOf5(
                it.atoms.map { atom -> LessonStepAnswerOneOf3AnswerOneOf5AtomsInner(atom.element, atom.id) },
                it.bonds.map { bond -> LessonStepAnswerOneOf3AnswerOneOf5BondsInner(bond.from, bond.order.toLong(), bond.to) },
                LessonStepAnswerOneOf3AnswerOneOf5.Kind.MOLECULE,
            ),
        )
    }

internal val ActivityAnswer?.molecule: MoleculeBuild?
    get() =
        (this as? MoleculeAnswerValue)?.value?.let { answer ->
            MoleculeBuild(
                answer.atoms.map { BuildAtom(it.element, it.id) },
                answer.bonds.map { BuildBond(it.from, it.order.toInt(), it.to) },
            )
        }

/** The server's expected molecule: how many atoms of each element it has. */
internal val ActivityExpected?.moleculeElements: Map<String, Int>?
    get() =
        ((this as? ActivityExpected.InteractionWrapper)?.value?.answer as? ActivityExpectedAnswer.MoleculeWrapper)
            ?.value
            ?.elements
            ?.mapValues { it.value.toInt() }

/** Main's `molecule-model.ts` and core's `chemistry.ts`: atoms joined by single, double or triple bonds. */
internal object Molecule {
    const val MAX_BOND_ORDER = 3

    fun valenceOf(element: String): Int = VALENCE[element] ?: 0

    /** "C6H12O6" as how many atoms of each element, in the formula's order; null when it isn't a formula. */
    fun parseFormula(formula: String): Map<String, Int>? {
        val matches = FORMULA_PART.findAll(formula).toList()
        if (matches.isEmpty() || matches.joinToString("") { it.value } != formula) return null
        return matches.fold(linkedMapOf()) { counts, match ->
            val element = match.groupValues[1]
            val count = match.groupValues[2].toIntOrNull() ?: 1
            counts.apply { put(element, (get(element) ?: 0) + count) }
        }
    }

    /** Adds an [element] atom, bonded once to [bondTo] when one is picked; returns the build and the new atom's id. */
    fun addAtom(
        build: MoleculeBuild,
        element: String,
        bondTo: String?,
    ): Pair<MoleculeBuild, String> {
        val prefix = element.lowercase()
        val taken = build.atoms.map { it.id }.toSet()
        val number = (1..build.atoms.size + 1).firstOrNull { "$prefix$it" !in taken } ?: (build.atoms.size + 1)
        val id = "$prefix$number"
        val bonds = if (bondTo == null) build.bonds else build.bonds + BuildBond(bondTo, 1, id)
        return MoleculeBuild(build.atoms + BuildAtom(element, id), bonds) to id
    }

    fun removeAtom(
        build: MoleculeBuild,
        id: String,
    ) = MoleculeBuild(build.atoms.filter { it.id != id }, build.bonds.filter { !it.touches(id) })

    fun bondOrder(
        build: MoleculeBuild,
        first: String,
        second: String,
    ): Int = build.bonds.firstOrNull { it.joins(first, second) }?.order ?: 0

    /** One more bond between two atoms, back to none after a triple. */
    fun stepBond(
        build: MoleculeBuild,
        first: String,
        second: String,
    ): MoleculeBuild {
        val order = (bondOrder(build, first, second) + 1) % (MAX_BOND_ORDER + 1)
        val others = build.bonds.filter { !it.joins(first, second) }
        return build.copy(bonds = if (order == 0) others else others + BuildBond(first, order, second))
    }

    fun bondsUsed(
        build: MoleculeBuild,
        id: String,
    ): Int = build.bonds.filter { it.touches(id) }.sumOf { it.order }

    fun fill(
        build: MoleculeBuild,
        atom: BuildAtom,
    ): AtomFill {
        val used = bondsUsed(build, atom.id)
        val valence = valenceOf(atom.element)
        return when {
            used > valence -> AtomFill.Over
            used == valence -> AtomFill.Full
            else -> AtomFill.Open
        }
    }

    fun counts(build: MoleculeBuild): Map<String, Int> = build.atoms.groupingBy { it.element }.eachCount()

    /** "CO₂": [order]'s elements first, each with its count as a subscript when there's more than one. */
    fun formulaText(
        counts: Map<String, Int>,
        order: List<String>,
    ): String =
        (order + counts.keys).distinct().filter { (counts[it] ?: 0) > 0 }.joinToString("") { element ->
            val count = counts.getValue(element)
            element + if (count == 1) "" else count.toString().map { SUBSCRIPTS[it - '0'] }.joinToString("")
        }

    fun bondTotal(build: MoleculeBuild): Int = build.bonds.sumOf { it.order }

    /** Core's `findMoleculeStructure`: one complete structure with these atoms, found by trying bonds in turn. */
    fun findStructure(counts: Map<String, Int>): MoleculeBuild? {
        val atoms =
            counts.entries
                .sortedWith(compareByDescending<Map.Entry<String, Int>> { valenceOf(it.key) }.thenBy { it.key })
                .flatMap { (element, count) -> (1..count).map { SearchAtom(element, "${element.lowercase()}$it", valenceOf(element)) } }
        if (atoms.isEmpty() || atoms.any { it.valence == 0 }) return null
        val found = search(atoms, SearchState(emptyMap(), atoms.map { it.valence }), Budget(MAX_SEARCH_STEPS)) ?: return null
        return MoleculeBuild(
            atoms.map { BuildAtom(it.element, it.id) },
            found.bonds.map { (pair, order) -> BuildBond(atoms[pair.first].id, order, atoms[pair.second].id) },
        )
    }

    private class SearchAtom(
        val element: String,
        val id: String,
        val valence: Int,
    )

    private class SearchState(
        val bonds: Map<Pair<Int, Int>, Int>,
        val remaining: List<Int>,
    )

    private class Budget(
        var left: Int,
    )

    private fun pairOf(
        first: Int,
        second: Int,
    ) = if (first < second) first to second else second to first

    private fun bondedTo(
        state: SearchState,
        index: Int,
    ): List<Int> =
        state.bonds.keys.mapNotNull { (first, second) ->
            when (index) {
                first -> second
                second -> first
                else -> null
            }
        }

    private fun componentOf(
        state: SearchState,
        reached: Set<Int>,
    ): Set<Int> {
        val grown = reached + reached.flatMap { bondedTo(state, it) }
        return if (grown.size == reached.size) reached else componentOf(state, grown)
    }

    private fun addBond(
        state: SearchState,
        first: Int,
        second: Int,
    ): SearchState {
        val key = pairOf(first, second)
        return SearchState(
            state.bonds + (key to (state.bonds[key] ?: 0) + 1),
            state.remaining.mapIndexed { index, value -> if (index == first || index == second) value - 1 else value },
        )
    }

    private fun candidates(
        atoms: List<SearchAtom>,
        state: SearchState,
        index: Int,
    ): List<Int> {
        val untouched = { atom: Int -> state.remaining[atom] == atoms[atom].valence }
        val component = componentOf(state, setOf(index))
        val open =
            atoms.indices.filter { atom ->
                atom != index && state.remaining[atom] > 0 && (state.bonds[pairOf(index, atom)] ?: 0) < MAX_BOND_ORDER
            }
        return open
            .filter { atom ->
                open.none { earlier ->
                    earlier < atom && untouched(atom) && untouched(earlier) &&
                        atoms[earlier].element == atoms[atom].element
                }
            }.sortedWith(compareBy<Int> { if (it in component) 1 else 0 }.thenByDescending { state.remaining[it] })
    }

    private fun search(
        atoms: List<SearchAtom>,
        state: SearchState,
        budget: Budget,
    ): SearchState? {
        if (budget.left <= 0) return null
        budget.left -= 1
        val index = state.remaining.indexOfFirst { it > 0 }
        if (index == -1) return state.takeIf { componentOf(state, setOf(0)).size == atoms.size }
        for (atom in candidates(atoms, state, index)) {
            search(atoms, addBond(state, index, atom), budget)?.let { return it }
        }
        return null
    }

    private fun BuildBond.touches(id: String) = from == id || to == id

    private fun BuildBond.joins(
        first: String,
        second: String,
    ) = touches(first) && touches(second)

    private val VALENCE =
        mapOf("B" to 3, "Br" to 1, "C" to 4, "Cl" to 1, "F" to 1, "H" to 1, "I" to 1, "N" to 3, "O" to 2, "P" to 3, "S" to 2, "Si" to 4)
    private val FORMULA_PART = Regex("([A-Z][a-z]?)(\\d*)")
    private const val SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉"
    private const val MAX_SEARCH_STEPS = 20_000
}

/** Main's `molecule-layout.ts`: atoms spread on a 320 × 240 board, bonded ones pulled to one bond length apart. */
internal object MoleculeLayout {
    const val ATOM_RADIUS = 23.0
    const val WIDTH = 320.0
    const val HEIGHT = 240.0

    fun place(
        anchor: String?,
        layout: Map<String, Vec>,
    ): Vec {
        val center = Vec(WIDTH / 2, HEIGHT / 2)
        val from = anchor?.let { layout[it] }
        val others = layout.filterKeys { it != anchor }.values.toList()

        if (from == null) {
            if (others.isEmpty()) return center
            val columns = max(floor((WIDTH - MARGIN * 2) / GRID_STEP).toInt(), 1)
            val rows = max(floor((HEIGHT - MARGIN * 2) / GRID_STEP).toInt(), 1)
            val grid =
                (0 until (columns + 1) * (rows + 1))
                    .map { Vec(MARGIN + (it % (columns + 1)) * GRID_STEP, MARGIN + (it / (columns + 1)) * GRID_STEP) }
                    .sortedBy { distance(it, center) }
            return roomiest(grid, others)
        }

        val around =
            (0 until DIRECTIONS).map {
                val angle = it.toDouble() / DIRECTIONS * 2 * PI
                clamp(Vec(from.x + BOND_LENGTH * cos(angle), from.y + BOND_LENGTH * sin(angle)))
            }
        return roomiest(around, others.ifEmpty { listOf(center) })
    }

    fun relax(
        bonds: List<BuildBond>,
        layout: Map<String, Vec>,
    ): Map<String, Vec> = (1..ITERATIONS).fold(layout) { current, _ -> relaxStep(current, bonds) }

    /** Places atoms one at a time next to an atom already placed that they bond to, then settles them. */
    fun of(build: MoleculeBuild): Map<String, Vec> {
        val placed =
            build.atoms.fold(linkedMapOf<String, Vec>()) { layout, atom ->
                val anchor = partnersOf(build.bonds, atom.id).firstOrNull { it in layout }
                layout.apply { put(atom.id, place(anchor, layout)) }
            }
        return relax(build.bonds, placed)
    }

    private fun relaxStep(
        layout: Map<String, Vec>,
        bonds: List<BuildBond>,
    ): Map<String, Vec> {
        val entries = layout.entries.toList()
        return entries
            .mapIndexed { index, (id, point) ->
                var forceX = 0.0
                var forceY = 0.0
                entries.forEachIndexed { otherIndex, (otherId, other) ->
                    if (otherId == id) return@forEachIndexed
                    val gap = distance(point, other)
                    val dx = if (gap == 0.0) cos((index - otherIndex).toDouble()) else (point.x - other.x) / gap
                    val dy = if (gap == 0.0) sin((index - otherIndex).toDouble()) else (point.y - other.y) / gap
                    val pull =
                        if (bonds.any { (it.from == id && it.to == otherId) || (it.from == otherId && it.to == id) }) {
                            (
                                BOND_LENGTH -
                                    gap
                            ) *
                                SPRING
                        } else {
                            0.0
                        }
                    val push = if (gap < PUSH_RANGE) (PUSH_RANGE - gap) * PUSH else 0.0
                    forceX += dx * (pull + push)
                    forceY += dy * (pull + push)
                }
                id to clamp(Vec(point.x + forceX, point.y + forceY))
            }.toMap(LinkedHashMap())
    }

    private fun partnersOf(
        bonds: List<BuildBond>,
        id: String,
    ): List<String> =
        bonds.mapNotNull {
            when (id) {
                it.from -> it.to
                it.to -> it.from
                else -> null
            }
        }

    private fun roomiest(
        candidates: List<Vec>,
        others: List<Vec>,
    ): Vec {
        val room = { point: Vec -> if (others.isEmpty()) 0.0 else others.minOf { distance(point, it) } }
        return candidates.reduce { best, point -> if (room(point) > room(best) + 1) point else best }
    }

    private fun clamp(point: Vec) =
        Vec(point.x.coerceIn(MARGIN, max(MARGIN, WIDTH - MARGIN)), point.y.coerceIn(MARGIN, max(MARGIN, HEIGHT - MARGIN)))

    private fun distance(
        first: Vec,
        second: Vec,
    ) = hypot(second.x - first.x, second.y - first.y)

    private const val BOND_LENGTH = 68.0
    private const val MARGIN = ATOM_RADIUS + 10
    private const val ITERATIONS = 160
    private const val SPRING = 0.12
    private const val PUSH = 0.06
    private const val PUSH_RANGE = 110.0
    private const val DIRECTIONS = 12
    private const val GRID_STEP = 24.0
}
