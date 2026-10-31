package com.zoonk.android.feature.activities.geometry

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `molecule-model.ts` and `molecule-layout.ts` and core's `chemistry.ts` and `molecule-structure.ts` return. */
class MoleculeModelTest {
    private fun atom(id: String) = BuildAtom(id.first().uppercase(), id)

    private fun bonds(vararg bonds: Triple<String, Int, String>) = bonds.map { (from, order, to) -> BuildBond(from, order, to) }

    private val single =
        MoleculeBuild(
            listOf(atom("c1"), atom("o1"), atom("o2")),
            listOf(BuildBond("c1", 1, "o1"), BuildBond("c1", 1, "o2")),
        )

    private val carbonDioxide =
        MoleculeBuild(
            listOf(atom("c1"), atom("o1"), atom("o2")),
            listOf(BuildBond("c1", 2, "o1"), BuildBond("o2", 2, "c1")),
        )

    @Test
    fun addsAtomsBondedToTheSelectedOne() {
        val (withCarbon, carbon) = Molecule.addAtom(MoleculeBuild(), "C", bondTo = null)
        val (withOxygen, oxygen) = Molecule.addAtom(withCarbon, "O", bondTo = "c1")
        val (built, second) = Molecule.addAtom(withOxygen, "O", bondTo = "c1")
        assertEquals(listOf("c1", "o1", "o2"), listOf(carbon, oxygen, second))
        assertEquals(single, built)
    }

    @Test
    fun bondsStepUpToTripleThenBackToNone() {
        assertEquals(
            listOf(2, 3, 0, 1),
            (1..4).map { times ->
                (1..times).fold(single) { build, _ -> Molecule.stepBond(build, "c1", "o1") }.let { Molecule.bondOrder(it, "o1", "c1") }
            },
        )
        assertEquals(carbonDioxide, Molecule.stepBond(Molecule.stepBond(single, "c1", "o1"), "o2", "c1"))
    }

    @Test
    fun countsBondsAndFindsOpenAndOverfilledAtoms() {
        assertEquals(listOf(AtomFill.Full, AtomFill.Full, AtomFill.Full), carbonDioxide.atoms.map { Molecule.fill(carbonDioxide, it) })
        val over = Molecule.stepBond(Molecule.stepBond(single, "o1", "o2"), "o1", "o2")
        assertEquals(listOf(AtomFill.Open, AtomFill.Over, AtomFill.Over), over.atoms.map { Molecule.fill(over, it) })
        assertEquals(4, Molecule.bondsUsed(carbonDioxide, "c1"))
        assertEquals(4, Molecule.bondTotal(carbonDioxide))
    }

    @Test
    fun removingAnAtomDropsItsBondsAndFreesItsId() {
        val removed = Molecule.removeAtom(carbonDioxide, "o1")
        assertEquals(MoleculeBuild(listOf(atom("c1"), atom("o2")), listOf(BuildBond("o2", 2, "c1"))), removed)
        assertEquals("o1", Molecule.addAtom(removed, "O", bondTo = null).second)
    }

    @Test
    fun readsAndWritesFormulas() {
        assertEquals(
            listOf(
                mapOf("C" to 1, "O" to 2),
                mapOf("H" to 2, "O" to 1),
                mapOf("C" to 6, "H" to 12, "O" to 6),
                mapOf("Na" to 1, "Cl" to 1),
                null,
                mapOf("C" to 1, "H" to 1, "Cl" to 3),
                null,
            ),
            listOf("CO2", "H2O", "C6H12O6", "NaCl", "co2", "CHCl3", "").map(Molecule::parseFormula),
        )
        assertEquals(
            listOf("CO₂", "C₆H₁₂O₆", "H₂O", "C"),
            listOf(
                Molecule.formulaText(Molecule.counts(carbonDioxide), listOf("C", "O")),
                Molecule.formulaText(mapOf("C" to 6, "H" to 12, "O" to 6), listOf("C", "H", "O")),
                Molecule.formulaText(mapOf("O" to 1, "H" to 2), listOf("H", "O")),
                Molecule.formulaText(mapOf("C" to 1, "O" to 0), listOf("C", "O")),
            ),
        )
    }

    @Test
    fun findsOneCompleteStructure() {
        assertEquals(
            listOf(
                MoleculeBuild(listOf(atom("c1"), atom("o1"), atom("o2")), bonds(Triple("c1", 2, "o1"), Triple("c1", 2, "o2"))),
                MoleculeBuild(listOf(atom("o1"), atom("h1"), atom("h2")), bonds(Triple("o1", 1, "h1"), Triple("o1", 1, "h2"))),
                MoleculeBuild(
                    listOf("c1", "c2", "h1", "h2", "h3", "h4", "h5", "h6").map(::atom),
                    bonds(
                        Triple("c1", 1, "c2"),
                        Triple("c1", 1, "h1"),
                        Triple("c1", 1, "h2"),
                        Triple("c1", 1, "h3"),
                        Triple("c2", 1, "h4"),
                        Triple("c2", 1, "h5"),
                        Triple("c2", 1, "h6"),
                    ),
                ),
                MoleculeBuild(listOf(atom("n1"), atom("n2")), bonds(Triple("n1", 3, "n2"))),
                MoleculeBuild(
                    listOf("c1", "c2", "o1", "o2", "h1", "h2", "h3", "h4").map(::atom),
                    bonds(
                        Triple("c1", 1, "c2"),
                        Triple("c1", 1, "o1"),
                        Triple("c1", 1, "o2"),
                        Triple("c1", 1, "h1"),
                        Triple("c2", 1, "h2"),
                        Triple("c2", 1, "h3"),
                        Triple("c2", 1, "h4"),
                        Triple("o1", 1, "o2"),
                    ),
                ),
            ),
            listOf(
                mapOf("C" to 1, "O" to 2),
                mapOf("H" to 2, "O" to 1),
                mapOf("C" to 2, "H" to 6),
                mapOf("N" to 2),
                mapOf("C" to 2, "H" to 4, "O" to 2),
            ).map(Molecule::findStructure),
        )
    }

    @Test
    fun laysAtomsOutOneBondApart() {
        val layout = MoleculeLayout.of(carbonDioxide)
        assertEquals(listOf("c1", "o1", "o2"), layout.keys.toList())
        val expected = listOf(Vec(160.0, 120.0), Vec(241.9999999999998, 120.0), Vec(78.00000000000023, 120.00000000000001))
        expected.zip(layout.values).forEach { (want, got) ->
            assertEquals(want.x, got.x, LAYOUT_SLACK)
            assertEquals(want.y, got.y, LAYOUT_SLACK)
        }
        assertEquals(Vec(160.0, 120.0), MoleculeLayout.place(null, emptyMap()))
        assertEquals(Vec(33.0, 33.0), MoleculeLayout.place(null, mapOf("c1" to Vec(160.0, 120.0))))
        assertEquals(Vec(228.0, 120.0), MoleculeLayout.place("c1", mapOf("c1" to Vec(160.0, 120.0))))
        val relaxed = MoleculeLayout.relax(listOf(BuildBond("a", 1, "b")), mapOf("a" to Vec(160.0, 120.0), "b" to Vec(160.0, 120.0)))
        listOf(
            167.97486203461375,
            79.0,
            167.97486203461375,
            160.99999999999997,
        ).zip(relaxed.values.flatMap { listOf(it.x, it.y) }).forEach { (want, got) ->
            assertEquals(want, got, LAYOUT_SLACK)
        }
    }

    private companion object {
        const val SLACK = 1e-9

        // The layout settles over 160 steps of square roots, where the JVM and V8 may round the last bit differently.
        const val LAYOUT_SLACK = 1e-6
    }
}
