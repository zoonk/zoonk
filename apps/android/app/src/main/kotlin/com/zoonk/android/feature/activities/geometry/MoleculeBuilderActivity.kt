package com.zoonk.android.feature.activities.geometry

import android.content.res.Resources
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateOffsetAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlin.math.sin
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf13Value as MoleculeBuilderContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value as InteractionCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

val moleculeBuilderRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_geometry_badge_build_it, R.drawable.ic_science) },
        canvas = { MoleculeBuilderActivity(it) },
    )

private data class Builder(
    val build: MoleculeBuild,
    val layout: Map<String, Vec>,
    val selectedId: String?,
)

private val builderSaver =
    listSaver<Builder, String>(
        save = { builder ->
            listOf(builder.selectedId.orEmpty()) +
                builder.build.atoms.map { "a ${it.element} ${it.id}" } +
                builder.build.bonds.map { "b ${it.from} ${it.order} ${it.to}" }
        },
        restore = { saved ->
            val parts = saved.drop(1).map { it.split(" ") }
            val build =
                MoleculeBuild(
                    parts.filter { it[0] == "a" }.map { BuildAtom(it[1], it[2]) },
                    parts.filter { it[0] == "b" }.map { BuildBond(it[1], it[2].toInt(), it[3]) },
                )
            Builder(build, MoleculeLayout.of(build), saved.first().ifEmpty { null })
        },
    )

private val historySaver =
    listSaver<List<Builder>, Any>(
        save = { history -> history.mapNotNull { with(builderSaver) { save(it) } } },
        restore = { saved -> saved.mapNotNull(builderSaver::restore) },
    )

@Composable
private fun MoleculeBuilderActivity(props: ActivityProps) {
    val content = (props.content as MoleculeBuilderContent).value
    val fields = content.fields
    val resources = LocalResources.current
    val target = Molecule.parseFormula(fields.formula).orEmpty()
    val order = target.keys.toList()
    val start = props.answer.molecule?.let { Builder(it, MoleculeLayout.of(it), null) } ?: Builder(MoleculeBuild(), emptyMap(), null)
    var builder by rememberSaveable(stateSaver = builderSaver) { mutableStateOf(start) }
    var history by rememberSaveable(stateSaver = historySaver) { mutableStateOf(emptyList()) }
    var announcement by rememberSaveable { mutableStateOf("") }
    val names = elementNames()
    val atomName = { atom: BuildAtom ->
        resources.getString(
            R.string.activities_geometry_molecule_atom,
            names[atom.element] ?: atom.element,
            atom.id.dropWhile { !it.isDigit() },
        )
    }
    val enabled = !props.isLocked
    val build = builder.build
    val nameIn = { within: MoleculeBuild, id: String ->
        within.atoms
            .firstOrNull { it.id == id }
            ?.let(atomName)
            .orEmpty()
    }
    val selected = build.atoms.firstOrNull { it.id == builder.selectedId }

    fun show(
        next: Builder,
        said: String,
    ) {
        builder = next
        announcement = said
        when (content.check) {
            is NumericCheckValue -> {
                props.onAnswerChange(
                    next.build
                        .takeIf {
                            it.bonds.isNotEmpty()
                        }?.let { numericAnswer(Molecule.bondTotal(it).toDouble()) },
                )
            }

            is InteractionCheckValue -> {
                props.onAnswerChange(moleculeAnswer(next.build))
            }

            else -> {}
        }
    }

    fun commit(
        next: Builder,
        said: String,
    ) {
        history = history + builder
        show(next, said)
    }

    fun add(element: String) {
        val current = builder
        val (next, id) = Molecule.addAtom(current.build, element, current.selectedId)
        val layout = MoleculeLayout.relax(next.bonds, current.layout + (id to MoleculeLayout.place(current.selectedId, current.layout)))
        val atom = atomName(next.atoms.last())
        val said =
            current.selectedId?.let {
                resources.getString(
                    R.string.activities_geometry_molecule_added_bonded,
                    atom,
                    nameIn(current.build, it),
                )
            }
                ?: resources.getString(R.string.activities_geometry_molecule_added, atom)
        commit(Builder(next, layout, current.selectedId ?: id), said)
    }

    fun press(id: String) {
        val current = builder
        val picked = current.selectedId
        if (picked == null || picked == id) {
            val next = if (picked == id) null else id
            builder = current.copy(selectedId = next)
            announcement =
                next?.let { resources.getString(R.string.activities_geometry_molecule_selected, nameIn(current.build, it)) }
                    ?: resources.getString(R.string.activities_geometry_molecule_none_selected)
            return
        }
        val next = Molecule.stepBond(current.build, picked, id)
        val said = bondText(resources, nameIn(next, picked), nameIn(next, id), Molecule.bondOrder(next, picked, id))
        commit(Builder(next, MoleculeLayout.relax(next.bonds, current.layout), picked), said)
    }

    fun remove() {
        val current = builder
        val id = current.selectedId ?: return
        val next = Molecule.removeAtom(current.build, id)
        commit(
            Builder(next, MoleculeLayout.relax(next.bonds, current.layout - id), null),
            resources.getString(R.string.activities_geometry_molecule_removed, nameIn(current.build, id)),
        )
    }

    fun undo() {
        val previous = history.lastOrNull() ?: return
        history = history.dropLast(1)
        show(previous, resources.getString(R.string.activities_geometry_molecule_undone))
    }

    val formula = Molecule.formulaText(target, order)
    val description =
        listOf(
            stringResource(R.string.activities_geometry_molecule_build, formula),
            describeBuild(build, atomName, resources),
        ).joinToString(" ")

    ActivityCanvas(description = description) {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            val style = MaterialTheme.typography.bodyMedium.withTabularFigures()
            val muted = MaterialTheme.colorScheme.onSurfaceVariant
            Text(stringResource(R.string.activities_geometry_molecule_target, formula), color = muted, style = style)
            if (build.atoms.isNotEmpty()) {
                Text(
                    stringResource(R.string.activities_geometry_molecule_built, Molecule.formulaText(Molecule.counts(build), order)),
                    color = muted,
                    style = style,
                )
            }
        }

        MoleculeBoard(
            build = build,
            layout = builder.layout,
            selectedId = builder.selectedId.takeIf { !props.isChecked },
            enabled = enabled,
            atomLabel = { atom ->
                pluralStringResource(
                    R.plurals.activities_geometry_molecule_atom_bonds,
                    Molecule.valenceOf(atom.element),
                    atomName(atom),
                    Molecule.bondsUsed(build, atom.id),
                    Molecule.valenceOf(atom.element),
                )
            },
            onPress = ::press,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MoleculeStatus(build, props.isChecked, selected?.let(atomName), announcement, atomName, Modifier.weight(1f))
            if (!props.isChecked) {
                val tools = Modifier.size(48.dp)
                OutlinedIconButton(onClick = ::undo, enabled = enabled && history.isNotEmpty(), modifier = tools) {
                    Icon(painterResource(R.drawable.ic_undo), stringResource(R.string.activities_geometry_molecule_undo))
                }
                OutlinedIconButton(onClick = ::remove, enabled = enabled && selected != null, modifier = tools) {
                    Icon(
                        painterResource(R.drawable.ic_delete),
                        selected?.let { stringResource(R.string.activities_geometry_molecule_remove, atomName(it)) }
                            ?: stringResource(R.string.activities_geometry_molecule_remove_selected),
                    )
                }
            }
        }

        if (!props.isChecked) {
            MoleculeElements(fields.elements, names, selected?.let(atomName), enabled && build.atoms.size < MAX_ATOMS, ::add)
        }

        if (props.isChecked && (content.check !is InteractionCheckValue || props.isCorrect != true)) {
            val elements = props.expected.moleculeElements ?: target
            Molecule.findStructure(elements)?.let { MoleculeExample(it, atomName) }
        }
    }
}

@Composable
private fun MoleculeBoard(
    build: MoleculeBuild,
    layout: Map<String, Vec>,
    selectedId: String?,
    enabled: Boolean,
    atomLabel: @Composable (BuildAtom) -> String,
    onPress: (String) -> Unit,
) {
    val density = LocalDensity.current
    val dots = MaterialTheme.colorScheme.outlineVariant
    val board = MaterialTheme.colorScheme.surface.copy(alpha = BOARD_ALPHA)

    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(board)
            .drawBehind { dotGrid(dots) },
        contentAlignment = Alignment.TopCenter,
    ) {
        val width = minOf(maxWidth, MAX_BOARD_WIDTH)
        val scale = with(density) { width.toPx() } / MoleculeLayout.WIDTH.toFloat()
        val height = width * (MoleculeLayout.HEIGHT / MoleculeLayout.WIDTH).toFloat()
        val shown = build.atoms.associate { atom -> atom.id to key(atom.id) { tweened(layout[atom.id] ?: Vec(0.0, 0.0), scale) } }

        Box(Modifier.size(width, height), contentAlignment = AbsoluteAlignment.TopLeft) {
            MoleculeDrawing(build, shown, selectedId, scale, Modifier.size(width, height))
            build.atoms.forEach { atom ->
                key(atom.id) {
                    AtomButton(
                        center = shown.getValue(atom.id),
                        radius = with(density) { (MoleculeLayout.ATOM_RADIUS.toFloat() * scale).toDp() },
                        label = atomLabel(atom),
                        selected = atom.id == selectedId,
                        enabled = enabled,
                        onClick = { onPress(atom.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun tweened(
    point: Vec,
    scale: Float,
): Offset {
    val target = Offset(point.x.toFloat() * scale, point.y.toFloat() * scale)
    val shown by animateOffsetAsState(target, tween(SETTLE_MILLIS, easing = EaseOutCubic), label = "atom")
    return shown
}

@Composable
private fun AtomButton(
    center: Offset,
    radius: Dp,
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val interactions = remember { MutableInteractionSource() }
    val focused by interactions.collectIsFocusedAsState()
    val ring = MaterialTheme.colorScheme.primary
    val size = maxOf(MIN_TARGET, radius * 2)

    Box(
        Modifier
            .absoluteOffset { IntOffset((center.x - size.toPx() / 2).roundToInt(), (center.y - size.toPx() / 2).roundToInt()) }
            .size(size)
            .drawBehind { if (focused) drawCircle(ring, (radius + FOCUS_GAP).toPx(), style = Stroke(2.5.dp.toPx())) }
            .clickable(interactions, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics {
                contentDescription = label
                this.selected = selected
            },
    )
}

@Composable
private fun MoleculeDrawing(
    build: MoleculeBuild,
    shown: Map<String, Offset>,
    selectedId: String?,
    scale: Float,
    modifier: Modifier,
) {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val letter = TextStyle(fontSize = with(density) { (LETTER_SIZE * scale).toSp() }, fontWeight = FontWeight.SemiBold)
    val ink = MaterialTheme.colorScheme.onSurface
    val halo = MaterialTheme.colorScheme.surface
    val accent = MaterialTheme.zoonk.vizAccent
    val full = MaterialTheme.colorScheme.tertiary
    val over = MaterialTheme.colorScheme.error
    val open = MaterialTheme.zoonk.warning

    Canvas(modifier.clearAndSetSemantics {}) {
        val radius = MoleculeLayout.ATOM_RADIUS.toFloat() * scale
        build.bonds.forEach { bond ->
            val from = shown[bond.from] ?: return@forEach
            val to = shown[bond.to] ?: return@forEach
            bondLines(from, to, bond.order, ink.copy(alpha = BOND_ALPHA), scale)
        }
        build.atoms.forEach { atom ->
            val center = shown[atom.id] ?: return@forEach
            val colors = elementColors(atom.element)
            if (atom.id == selectedId) {
                drawCircle(accent.copy(alpha = SELECTED_ALPHA), radius + RING_GAP * scale, center)
                drawCircle(accent, radius + RING_GAP * scale, center, style = Stroke(3 * scale))
            }
            drawCircle(colors.fill, radius, center)
            when (Molecule.fill(build, atom)) {
                AtomFill.Open -> drawCircle(ink.copy(alpha = OPEN_RING_ALPHA), radius, center, style = Stroke(1.5f * scale))
                AtomFill.Full -> drawCircle(full, radius, center, style = Stroke(3 * scale))
                AtomFill.Over -> drawCircle(over, radius, center, style = Stroke(3 * scale))
            }
            val text = measurer.measure(atom.element, letter.copy(color = colors.text))
            drawText(text, topLeft = center - Offset(text.size.width / 2f, text.size.height / 2f))
            val missing = (Molecule.valenceOf(atom.element) - Molecule.bondsUsed(build, atom.id)).coerceAtLeast(0)
            repeat(missing) { index ->
                val angle = (OPEN_DOT_START + index * OPEN_DOT_SPREAD) * PI / HALF_TURN
                val distance = radius + OPEN_DOT_OFFSET * scale
                val dot = center + Offset((cos(angle) * distance).toFloat(), (sin(angle) * distance).toFloat())
                drawCircle(open, OPEN_DOT_RADIUS * scale, dot)
                drawCircle(halo, OPEN_DOT_RADIUS * scale, dot, style = Stroke(1.5f * scale))
            }
        }
    }
}

private fun DrawScope.bondLines(
    from: Offset,
    to: Offset,
    order: Int,
    color: Color,
    scale: Float,
) {
    val length = hypot(to.x - from.x, to.y - from.y).takeIf { it != 0f } ?: 1f
    val normal = Offset(-(to.y - from.y) / length, (to.x - from.x) / length)
    repeat(order) { index ->
        val shift = normal * ((index - (order - 1) / 2f) * BOND_GAP * 2 * scale)
        drawLine(color, from + shift, to + shift, 3 * scale, StrokeCap.Round)
    }
}

private fun DrawScope.dotGrid(color: Color) {
    val step = DOT_STEP.toPx()
    val radius = 1.dp.toPx()
    var y = step / 2
    while (y < size.height) {
        var x = step / 2
        while (x < size.width) {
            drawCircle(color, radius, Offset(x, y))
            x += step
        }
        y += step
    }
}

@Composable
private fun MoleculeStatus(
    build: MoleculeBuild,
    isChecked: Boolean,
    selectedName: String?,
    announcement: String,
    atomName: (BuildAtom) -> String,
    modifier: Modifier,
) {
    val over = build.atoms.firstOrNull { Molecule.fill(build, it) == AtomFill.Over }
    val open = build.atoms.count { Molecule.fill(build, it) == AtomFill.Open }
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val style = MaterialTheme.typography.bodyMedium
    val strong = style.copy(fontWeight = FontWeight.Medium)
    val (status, color, statusStyle) =
        when {
            build.atoms.isEmpty() -> {
                Triple(stringResource(R.string.activities_geometry_molecule_start), muted, style)
            }

            over != null -> {
                Triple(
                    stringResource(R.string.activities_geometry_molecule_over, atomName(over)),
                    MaterialTheme.colorScheme.error,
                    strong,
                )
            }

            open > 0 -> {
                Triple(pluralStringResource(R.plurals.activities_geometry_molecule_open, open, open), muted, style)
            }

            else -> {
                Triple(stringResource(R.string.activities_geometry_molecule_full), MaterialTheme.colorScheme.onTertiaryContainer, strong)
            }
        }
    val hint =
        when {
            isChecked || build.atoms.isEmpty() -> null
            selectedName != null -> stringResource(R.string.activities_geometry_molecule_selected_hint, selectedName)
            else -> stringResource(R.string.activities_geometry_molecule_select_hint)
        }

    // TalkBack hears what each tap did first, as main's live announcement says it.
    Column(
        modifier.semantics(mergeDescendants = true) {
            liveRegion = LiveRegionMode.Polite
            contentDescription = listOfNotNull(announcement.ifEmpty { null }, status, hint).joinToString(" ")
        },
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(status, color = color, style = statusStyle)
        hint?.let { Text(it, color = muted, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun MoleculeElements(
    elements: List<String>,
    names: Map<String, String>,
    selectedName: String?,
    enabled: Boolean,
    onAdd: (String) -> Unit,
) {
    val border = MaterialTheme.colorScheme.outlineVariant
    val shape = RoundedCornerShape(12.dp)

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val minWidth = ELEMENT_MIN_WIDTH * LocalDensity.current.fontScale.coerceAtLeast(1f)
        val columns = ((maxWidth + GAP) / (minWidth + GAP)).toInt().coerceAtLeast(1)
        Column(verticalArrangement = Arrangement.spacedBy(GAP)) {
            elements.chunked(columns).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(GAP)) {
                    row.forEach { element ->
                        val name = names[element] ?: element
                        val label =
                            selectedName?.let { stringResource(R.string.activities_geometry_molecule_add_bonded, name, it) }
                                ?: stringResource(R.string.activities_geometry_molecule_add, name)
                        Row(
                            Modifier
                                .weight(1f)
                                .heightIn(min = 48.dp)
                                .clip(shape)
                                .background(MaterialTheme.colorScheme.surface)
                                .border(1.dp, border, shape)
                                .clickable(enabled = enabled, role = Role.Button) { onAdd(element) }
                                .semantics(mergeDescendants = true) { contentDescription = label }
                                .padding(horizontal = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            ElementSwatch(element, Modifier.padding(vertical = 8.dp))
                            Text(
                                pluralStringResource(
                                    R.plurals.activities_geometry_molecule_bonds,
                                    Molecule.valenceOf(element),
                                    Molecule.valenceOf(element),
                                ),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelLarge,
                                modifier = Modifier.clearAndSetSemantics {},
                            )
                        }
                    }
                    repeat(columns - row.size) { Box(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun ElementSwatch(
    element: String,
    modifier: Modifier = Modifier,
) {
    val measurer = rememberTextMeasurer()
    val colors = elementColors(element)
    val edge = MaterialTheme.colorScheme.onSurface.copy(alpha = OPEN_RING_ALPHA)
    val style = TextStyle(fontSize = SWATCH_LETTER, fontWeight = FontWeight.SemiBold, color = colors.text)

    Canvas(modifier.size(with(LocalDensity.current) { SWATCH.toDp() }).clearAndSetSemantics {}) {
        drawCircle(colors.fill)
        drawCircle(edge, style = Stroke(1.dp.toPx()))
        val text = measurer.measure(element, style)
        drawText(text, topLeft = center - Offset(text.size.width / 2f, text.size.height / 2f))
    }
}

@Composable
private fun MoleculeExample(
    structure: MoleculeBuild,
    atomName: (BuildAtom) -> String,
) {
    val density = LocalDensity.current
    val resources = LocalResources.current
    val layout = remember(structure) { MoleculeLayout.of(structure) }
    val total = Molecule.bondTotal(structure)

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Text(
            stringResource(R.string.activities_geometry_molecule_example),
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
        )
        BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            val padding = MoleculeLayout.ATOM_RADIUS + FIT_MARGIN
            val left = layout.values.minOf { it.x } - padding
            val top = layout.values.minOf { it.y } - padding
            val spanX = layout.values.maxOf { it.x } + padding - left
            val spanY = layout.values.maxOf { it.y } + padding - top
            val width = minOf(maxWidth, EXAMPLE_WIDTH)
            val scale = with(density) { width.toPx() } / spanX.toFloat()
            val shown = layout.mapValues { (_, point) -> Offset(((point.x - left) * scale).toFloat(), ((point.y - top) * scale).toFloat()) }
            MoleculeDrawing(
                structure,
                shown,
                selectedId = null,
                scale = scale,
                modifier =
                    Modifier.size(width, width * (spanY / spanX).toFloat()).semantics {
                        contentDescription = describeBuild(structure, atomName, resources)
                    },
            )
        }
        Text(
            pluralStringResource(R.plurals.activities_geometry_molecule_bonds_in_all, total, total),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

private fun bondText(
    resources: Resources,
    first: String,
    second: String,
    order: Int,
): String =
    resources.getString(
        when (order) {
            0 -> R.string.activities_geometry_molecule_no_bond
            1 -> R.string.activities_geometry_molecule_single_bond
            2 -> R.string.activities_geometry_molecule_double_bond
            else -> R.string.activities_geometry_molecule_triple_bond
        },
        first,
        second,
    )

private fun describeBuild(
    build: MoleculeBuild,
    atomName: (BuildAtom) -> String,
    resources: Resources,
): String {
    val named = { id: String -> build.atoms.firstOrNull { it.id == id }?.let(atomName) ?: id }
    val bonds = build.bonds.map { bondText(resources, named(it.from), named(it.to), it.order) }
    val loose =
        build.atoms
            .filter { atom -> build.bonds.none { it.from == atom.id || it.to == atom.id } }
            .map { resources.getString(R.string.activities_geometry_molecule_loose, atomName(it)) }
    return (bonds + loose).joinToString(" ")
}

@Composable
private fun elementNames(): Map<String, String> =
    mapOf(
        "B" to stringResource(R.string.activities_geometry_element_boron),
        "Br" to stringResource(R.string.activities_geometry_element_bromine),
        "C" to stringResource(R.string.activities_geometry_element_carbon),
        "Cl" to stringResource(R.string.activities_geometry_element_chlorine),
        "F" to stringResource(R.string.activities_geometry_element_fluorine),
        "H" to stringResource(R.string.activities_geometry_element_hydrogen),
        "I" to stringResource(R.string.activities_geometry_element_iodine),
        "N" to stringResource(R.string.activities_geometry_element_nitrogen),
        "O" to stringResource(R.string.activities_geometry_element_oxygen),
        "P" to stringResource(R.string.activities_geometry_element_phosphorus),
        "S" to stringResource(R.string.activities_geometry_element_sulfur),
        "Si" to stringResource(R.string.activities_geometry_element_silicon),
    )

private class ElementColors(
    val fill: Color,
    val text: Color,
)

// Atom colors follow chemistry's convention (main's `element-style.ts`), not the app's roles, and stay the same in every theme.
private fun elementColors(element: String): ElementColors =
    when (element) {
        "B" -> ElementColors(Color(0xFFFFA1AD), DARK_LETTER)
        "Br" -> ElementColors(Color(0xFFC10007), Color.White)
        "C" -> ElementColors(Color(0xFF262626), Color.White)
        "Cl" -> ElementColors(Color(0xFF05DF72), DARK_LETTER)
        "F" -> ElementColors(Color(0xFFBBF451), DARK_LETTER)
        "H" -> ElementColors(Color.White, DARK_LETTER)
        "I" -> ElementColors(Color(0xFFA684FF), DARK_LETTER)
        "N" -> ElementColors(Color(0xFF51A2FF), DARK_LETTER)
        "O" -> ElementColors(Color(0xFFFF6467), DARK_LETTER)
        "P" -> ElementColors(Color(0xFFFF8904), DARK_LETTER)
        "S" -> ElementColors(Color(0xFFFDC700), DARK_LETTER)
        "Si" -> ElementColors(Color(0xFFA6A09B), DARK_LETTER)
        else -> ElementColors(Color(0xFFA1A1A1), DARK_LETTER)
    }

private val DARK_LETTER = Color(0xFF171717)
private val EaseOutCubic = CubicBezierEasing(0.33f, 1f, 0.68f, 1f)
private val MAX_BOARD_WIDTH = 400.dp
private val EXAMPLE_WIDTH = 260.dp
private val MIN_TARGET = 48.dp
private val FOCUS_GAP = 8.dp
private val DOT_STEP = 18.dp
private val GAP = 8.dp
private val ELEMENT_MIN_WIDTH = 104.dp
private val SWATCH = 28.sp
private val SWATCH_LETTER = 12.sp
private const val MAX_ATOMS = 16
private const val SETTLE_MILLIS = 240
private const val LETTER_SIZE = 17f
private const val RING_GAP = 4f
private const val BOND_GAP = 5f
private const val OPEN_DOT_RADIUS = 4.5f
private const val OPEN_DOT_OFFSET = 9f
private const val OPEN_DOT_SPREAD = 28
private const val OPEN_DOT_START = -90
private const val HALF_TURN = 180.0
private const val FIT_MARGIN = 14.0
private const val BOARD_ALPHA = 0.6f
private const val BOND_ALPHA = 0.75f
private const val SELECTED_ALPHA = 0.2f
private const val OPEN_RING_ALPHA = 0.25f
