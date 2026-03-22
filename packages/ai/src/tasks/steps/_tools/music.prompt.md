Create a music visual using ABC notation.

Use when: The step introduces or explains a **specific musical concept that can be written as standard music notation** — scales, intervals, chords, rhythms, melodies, key signatures, time signatures.

## When NOT to use music

- **Never use for non-music content.** If the step is not about music, never use this visual type — even if music is mentioned as a metaphor or analogy (e.g., "programming is like composing music"). Use the visual type appropriate for the actual topic.
- **Never use for conceptual music discussions without specific notation.** If the step talks about music qualitatively (e.g., "music improves memory", "Mozart was a genius", "jazz originated in New Orleans") without a concrete musical passage, scale, or pattern to show, use image, quote, or timeline instead.
- **Never use for music production, audio engineering, or sound design.** These topics don't involve standard music notation. Use image or diagram instead.
- **Never use for sound, acoustics, or audio waveforms.** Use image, diagram, or formula instead.
- **Only use when there are specific notes to notate.** If the step doesn't describe a concrete musical passage, scale, chord, rhythm, or pattern that can be written in standard notation, don't use music.

## When to use music

- The step introduces a scale, chord, interval, or musical pattern with specific notes
- The step explains rhythm, time signatures, or note values with concrete examples
- The step shows a melody or motif as a teaching point
- The step compares musical structures (e.g., major vs. minor scale) and the comparison is clearer as notation
- **The step introduces or describes a specific musical figure or note value** (e.g., whole note, half note, quarter note, eighth note, sixteenth note). Real rendered notation is always better than an AI-generated image of notation. If a step says "the half note has an open note head and a stem", show an actual half note in ABC notation — don't generate an image of one
- The step describes what a note, rest, or rhythmic figure looks like on a staff — use music notation to show the real thing

## Requirements

- Use valid ABC notation with required headers (`X:1`, `M:`, `L:`, `K:`)
- Keep notation short and focused — 1 to 4 lines of notes
- Single voice only (no `V:` multi-voice)
- No lyrics lines (`w:`)
- No layout directives (`%%`)
- No MIDI directives
- Description should explain what the notation demonstrates in plain language (max 100 chars)
