const SHARED_EXPECTATIONS = `
ANTI-CHECKLIST GUIDANCE (READ THIS FIRST - CRITICAL):
- Do NOT penalize for missing steps you might expect
- Do NOT require a specific number of steps - let complexity dictate length
- Do NOT check against an imagined "ideal" procedure
- Do NOT interpret rules too literally - use common sense
- Different valid procedures exist - assess the quality of what IS provided
- ONLY penalize for actual problems: incorrect sequence, factual errors, missing critical safety steps, or truly confusing instructions

EVALUATION CRITERIA:

1. PROCEDURAL ACCURACY: Steps must be in correct sequence. Penalize only if actions are genuinely out of order or skip critical prerequisites.

2. ACTION-ORIENTED LANGUAGE: Each step must use imperative verbs (Click, Type, Add, Place, Turn, etc.). Penalize passive or purely descriptive language.

3. LOGICAL STEP GROUPING: Steps should be coherent units that a user can follow without confusion. This does NOT mean micro-splitting every movement:
   - ACCEPTABLE: "Click the File name field and type your document name" (filling a form field is ONE action)
   - ACCEPTABLE: "Pull over safely and turn on hazard lights" (logically grouped safety actions)
   - ACCEPTABLE: "Pour hot water, swirl to warm, then discard" (continuous motion)
   - PROBLEMATIC: "Download the file, install it, configure settings, and restart" (unrelated actions crammed together)
   The goal is clarity, not arbitrary splitting. If a step reads naturally and a user can follow it without confusion, it's fine.

4. VERIFICATION POINTS: Where helpful, include confirmation of success. Only penalize if verification is missing for critical/risky actions. Do NOT penalize verification steps as "padding" - helping users confirm success is valuable teaching.

5. FORMAT COMPLIANCE:
   - title: Maximum 50 characters
   - text: Maximum 300 characters

6. SCOPE ADHERENCE: Content should cover the activity as described. Do not penalize for reasonable setup or verification steps.

7. PRACTICAL FOCUS: Steps should be actionable instructions, not conceptual explanations.

FINAL CHECK: Before penalizing anything, ask yourself: "Would a reasonable human instructor consider this a genuine problem?" If not, do not penalize.
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Git installation involves platform-specific steps. Penalize if:
   - Steps assume wrong operating system without clarification
   - Installation verification is missing (checking git version)

2. SAFETY CHECK: Penalize if:
   - Steps suggest downloading from unofficial sources
   - PATH configuration is skipped without noting it's handled by installer

3. SPECIFICITY CHECK: Penalize vague instructions like "install Git" without specifying what to click, download, or run.

${SHARED_EXPECTATIONS}
    `,
    id: "en-tech-install-git",
    userInput: {
      activityDescription:
        "Download and install Git on your computer, including verification that the installation succeeded",
      activityTitle: "Install Git",
      chapterTitle: "Getting Started",
      courseTitle: "Git Fundamentals",
      language: "en",
      lessonDescription:
        "Setting up your development environment by installing and configuring Git version control",
      lessonTitle: "How to Set Up Git",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Tire removal requires specific safety sequences. Penalize if:
   - Loosening lug nuts is described AFTER the car is fully jacked up (must loosen while on ground)
   - Jack placement doesn't mention finding the correct jack point

2. SAFETY CHECK: Penalize if:
   - No mention of engaging parking brake or using wheel chocks
   - Steps allow working under an unsupported vehicle

3. TOOL SPECIFICITY: Penalize if steps don't specify which tools are used for each action (lug wrench, jack, etc.).

${SHARED_EXPECTATIONS}
    `,
    id: "en-automotive-remove-flat-tire",
    userInput: {
      activityDescription:
        "Safely remove a flat tire from your vehicle, including proper jacking and lug nut removal",
      activityTitle: "Remove the Flat Tire",
      chapterTitle: "Roadside Emergencies",
      courseTitle: "Basic Car Maintenance",
      language: "en",
      lessonDescription:
        "Step-by-step guide to safely changing a flat tire on the side of the road",
      lessonTitle: "Changing a Car Tire",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: French press brewing has critical timing and temperature elements. Penalize if:
   - Water temperature guidance is missing or incorrect (should be just off boiling, around 200F/93C)
   - Steep time is not mentioned or is outside the 4-5 minute range

2. RATIO CHECK: Penalize if:
   - Coffee-to-water ratio is absent or unreasonable
   - Grind size guidance is missing (coarse grind is essential)

3. SEQUENCE CHECK: Penalize if bloom step is skipped or plunging happens before steeping is complete.

${SHARED_EXPECTATIONS}
    `,
    id: "en-cooking-brew-coffee",
    userInput: {
      activityDescription:
        "Brew a perfect cup of coffee using a French press, from measuring grounds to plunging and pouring",
      activityTitle: "Brew the Coffee",
      chapterTitle: "Coffee Brewing Methods",
      courseTitle: "Home Barista Basics",
      language: "en",
      lessonDescription:
        "Master the French press method for making rich, full-bodied coffee at home",
      lessonTitle: "Making French Press Coffee",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Soil preparation involves physical and chemical considerations. Penalize if:
   - Depth guidance is missing (tomatoes need deep, loose soil)
   - Steps combine too many amendments without explaining when to add each

2. TIMING CHECK: Penalize if:
   - No mention of when to prepare soil relative to planting
   - Watering the prepared bed is omitted

3. SPECIFICITY CHECK: Penalize vague instructions like "add fertilizer" without specifying type, amount, or how to incorporate it.

${SHARED_EXPECTATIONS}
    `,
    id: "en-gardening-prepare-soil",
    userInput: {
      activityDescription:
        "Prepare a garden bed for tomato planting by loosening, amending, and conditioning the soil",
      activityTitle: "Prepare the Soil",
      chapterTitle: "Growing Vegetables",
      courseTitle: "Home Gardening",
      language: "en",
      lessonDescription:
        "Complete guide to planting and growing healthy tomato plants in your home garden",
      lessonTitle: "Planting Tomatoes",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Fabric cutting requires measurement and alignment. Penalize if:
   - Grain line alignment is ignored (fabric must be cut on grain)
   - Seam allowance is not mentioned or added

2. TOOL SAFETY: Penalize if:
   - Sharp tool handling guidance is absent
   - Fabric is described as being cut while held in air (should be flat on surface)

3. PRECISION CHECK: Penalize if pinning before cutting is skipped or pattern placement is vague.

${SHARED_EXPECTATIONS}
    `,
    id: "en-crafts-cut-fabric",
    userInput: {
      activityDescription:
        "Measure, pin, and cut fabric pieces for a pillowcase following a pattern",
      activityTitle: "Cut the Fabric",
      chapterTitle: "Basic Sewing Projects",
      courseTitle: "Sewing for Beginners",
      language: "en",
      lessonDescription:
        "Learn to sew a simple pillowcase from start to finish using basic techniques",
      lessonTitle: "Sewing a Pillowcase",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Guitar tuning follows a specific string order and pitch reference. Penalize if:
   - String order is incorrect (standard: E-A-D-G-B-E, low to high)
   - No reference pitch source is mentioned (tuner, app, or reference note)

2. TECHNIQUE CHECK: Penalize if:
   - Direction to turn tuning pegs is unclear or incorrect
   - No guidance on whether to tune up or down to pitch

3. VERIFICATION CHECK: Penalize if confirmation of correct pitch is missing for each string.

${SHARED_EXPECTATIONS}
    `,
    id: "en-music-tune-guitar",
    userInput: {
      activityDescription:
        "Tune each string of your guitar to standard tuning using a tuner or reference pitch",
      activityTitle: "Tune Your Guitar",
      chapterTitle: "Guitar Basics",
      courseTitle: "Learn Guitar",
      language: "en",
      lessonDescription:
        "Essential setup steps before you start playing guitar, including tuning and posture",
      lessonTitle: "Getting Started with Guitar",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Exposure adjustment involves specific camera controls. Penalize if:
   - ISO, aperture, and shutter speed relationship is confused
   - Steps don't specify which dial or setting to change

2. FEEDBACK CHECK: Penalize if:
   - No mention of checking the exposure meter or histogram
   - Steps don't explain how to verify exposure is correct

3. MODE CHECK: Penalize if steps assume wrong camera mode (should specify Manual or appropriate semi-auto mode).

${SHARED_EXPECTATIONS}
    `,
    id: "en-photography-adjust-exposure",
    userInput: {
      activityDescription:
        "Adjust your camera's exposure settings (ISO, aperture, shutter speed) to achieve proper exposure for your scene",
      activityTitle: "Adjust Camera Exposure",
      chapterTitle: "Camera Controls",
      courseTitle: "Photography Fundamentals",
      language: "en",
      lessonDescription:
        "Understanding and using manual camera settings to control exposure",
      lessonTitle: "Manual Camera Settings",
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Squat form involves specific body positioning. Penalize if:
   - Foot placement width and angle are not specified
   - Knee tracking direction is incorrect or missing

2. SAFETY CHECK: Penalize if:
   - Breathing pattern is not mentioned
   - Back position (neutral spine) is not addressed
   - Depth guidance is missing or unsafe

3. VERIFICATION CHECK: Penalize if no cues for self-checking form are provided (mirror check, how it should feel).

${SHARED_EXPECTATIONS}
    `,
    id: "en-fitness-proper-squat-form",
    userInput: {
      activityDescription:
        "Learn and practice the correct body positioning for a proper bodyweight squat",
      activityTitle: "Master Proper Form",
      chapterTitle: "Lower Body Exercises",
      courseTitle: "Strength Training Basics",
      language: "en",
      lessonDescription:
        "Complete guide to performing squats safely and effectively for building lower body strength",
      lessonTitle: "How to Do Squats",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Bread dough preparation requires specific techniques. Penalize if:
   - Ingredient order matters and is wrong (yeast activation before mixing with flour)
   - Kneading technique or duration guidance is missing

2. TEXTURE CHECK: Penalize if:
   - No description of what the dough should look/feel like at each stage
   - Proofing instructions are missing or lack time/visual cues

3. TEMPERATURE CHECK: Penalize if water temperature for yeast is not specified (critical for yeast activation).

${SHARED_EXPECTATIONS}
    `,
    id: "pt-cooking-preparar-massa",
    userInput: {
      activityDescription:
        "Prepare a massa do pao, incluindo ativacao do fermento, mistura dos ingredientes e sova",
      activityTitle: "Preparar a Massa",
      chapterTitle: "Paes Caseiros",
      courseTitle: "Panificacao em Casa",
      language: "pt",
      lessonDescription:
        "Aprenda a fazer pao caseiro do zero, desde a preparacao da massa ate o cozimento",
      lessonTitle: "Fazendo Pao Caseiro",
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: Faucet repair involves specific plumbing steps. Penalize if:
   - Water supply shutoff is not the first step
   - Disassembly order is incorrect (handle before cartridge/stem)

2. SAFETY CHECK: Penalize if:
   - Draining residual water is skipped
   - No mention of placing parts in order for reassembly

3. TOOL SPECIFICITY: Penalize if tools needed are not specified (adjustable wrench, screwdriver type, etc.).

${SHARED_EXPECTATIONS}
    `,
    id: "es-home-repair-fix-faucet",
    userInput: {
      activityDescription:
        "Repara un grifo que gotea, desde cerrar el agua hasta reemplazar las piezas danadas",
      activityTitle: "Reparar el Grifo",
      chapterTitle: "Reparaciones de Plomeria",
      courseTitle: "Mantenimiento del Hogar",
      language: "es",
      lessonDescription:
        "Guia paso a paso para reparar fugas de agua comunes en tu hogar",
      lessonTitle: "Arreglar una Fuga de Agua",
    },
  },
  {
    expectations: `
EDGE CASE: SIMPLE ACTIVITY

TOPIC-SPECIFIC GUIDANCE:

1. SCOPE CHECK: This is a straightforward task. Assess whether the steps are:
   - Clear and followable
   - Appropriate for the actual complexity of saving a document

2. COMPLETENESS CHECK: Steps should include:
   - The actual save action (via menu or keyboard shortcut)
   - Some form of verification that save succeeded

3. WHAT IS NOT PADDING:
   - Teaching multiple ways to save (menu AND keyboard shortcut) is good pedagogy, not padding
   - Having the user confirm they have content to save is reasonable guidance
   - Verification steps that teach users what to look for are valuable
   - Do NOT penalize for thoroughness that helps beginners

4. The number of steps should match what's needed to clearly explain the process. A few steps or several steps can both be appropriate depending on how the author chooses to break down the task.

${SHARED_EXPECTATIONS}
    `,
    id: "en-short-activity",
    userInput: {
      activityDescription: "Save your current document to preserve your work",
      activityTitle: "Save the Document",
      chapterTitle: "Document Basics",
      courseTitle: "Office Software Essentials",
      language: "en",
      lessonDescription:
        "Learn fundamental word processing operations including creating, saving, and organizing documents",
      lessonTitle: "Basic Word Processing",
    },
  },
  {
    expectations: `
EDGE CASE: COMPLEX ACTIVITY (15+ steps may be appropriate)

TOPIC-SPECIFIC GUIDANCE:

1. SCOPE CHECK: This is a complex multi-component task. Penalize if:
   - Critical components are skipped (CPU, RAM, storage, power)
   - The order of component installation is physically impossible

2. SAFETY CHECK: Penalize if:
   - ESD (electrostatic discharge) precautions are not mentioned
   - Power connection sequence is incorrect

3. VERIFICATION CHECK: Penalize if POST (Power-On Self-Test) or initial boot verification is missing at the end.

4. Do NOT penalize for having many steps (15+) - this is appropriate for the task complexity.

${SHARED_EXPECTATIONS}
    `,
    id: "en-complex-activity",
    userInput: {
      activityDescription:
        "Assemble a desktop computer from individual components, including installing CPU, RAM, storage, GPU, and connecting power",
      activityTitle: "Assemble the Computer",
      chapterTitle: "Hardware Assembly",
      courseTitle: "PC Building",
      language: "en",
      lessonDescription:
        "Complete guide to building your own desktop computer from scratch",
      lessonTitle: "Building a PC",
    },
  },
];
