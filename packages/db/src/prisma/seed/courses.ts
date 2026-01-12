import { normalizeString } from "@zoonk/utils/string";
import type { PrismaClient } from "../../generated/prisma/client";
import type { SeedOrganizations } from "./orgs";

export const coursesData = [
  // English courses
  {
    description:
      "A draft course for E2E testing. This course should only appear in the draft courses list.",
    imageUrl: null,
    isPublished: false,
    language: "en",
    normalizedTitle: normalizeString("E2E Draft Course"),
    slug: "e2e-draft-course",
    title: "E2E Draft Course",
  },
  {
    description:
      "A course with no chapters for E2E testing generation status redirect.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("E2E No Chapters Course"),
    slug: "e2e-no-chapters-course",
    title: "E2E No Chapters Course",
  },
  {
    description:
      "Machine learning enables computers to identify patterns and make predictions from data. Covers supervised and unsupervised techniques, neural networks, and model evaluation. Prepares you to work as a machine learning engineer at tech companies, research labs, or startups building AI products.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Machine Learning"),
    slug: "machine-learning",
    title: "Machine Learning",
  },
  {
    description:
      "Proficiency in Spanish from beginner (A1) to advanced (C2), covering conversation, reading, writing, and listening comprehension. Enables communication in personal and professional contexts across Spanish-speaking countries.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/spanish-G8NTOu5F2vUzMSaJ7oa2hgKrzAQtGr.webp",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Spanish"),
    slug: "spanish",
    title: "Spanish",
  },
  {
    description:
      "Astronomy studies celestial objects, space phenomena, and the structure of the universe. Covers planets, stars, galaxies, black holes, and cosmology from observational techniques to theoretical frameworks.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Astronomy"),
    slug: "astronomy",
    title: "Astronomy",
  },
  {
    description:
      "Master Python programming from fundamentals to advanced concepts. Learn syntax, data structures, functions, object-oriented programming, and build real-world applications.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Python Programming"),
    slug: "python-programming",
    title: "Python Programming",
  },
  {
    description:
      "Build modern web applications with HTML, CSS, JavaScript, and popular frameworks. Learn frontend and backend development, APIs, and deployment strategies.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Web Development"),
    slug: "web-development",
    title: "Web Development",
  },
  {
    description:
      "Analyze and interpret complex data using statistical methods and visualization tools. Learn data wrangling, exploratory analysis, and machine learning applications.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Data Science"),
    slug: "data-science",
    title: "Data Science",
  },
  {
    description:
      "Learn the fundamentals of economics including microeconomics, macroeconomics, market structures, and economic policy. Understand how economies function and make informed financial decisions.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Introduction to Economics"),
    slug: "introduction-to-economics",
    title: "Introduction to Economics",
  },
  {
    description:
      "Master digital photography from camera basics to advanced composition techniques. Learn lighting, post-processing, and develop your artistic vision.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Digital Photography"),
    slug: "digital-photography",
    title: "Digital Photography",
  },
  {
    description:
      "Understand the principles of nutrition and how food affects your health. Learn about macronutrients, micronutrients, meal planning, and evidence-based dietary guidelines.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Nutrition Fundamentals"),
    slug: "nutrition-fundamentals",
    title: "Nutrition Fundamentals",
  },
  {
    description:
      "Explore the history and techniques of Western philosophy. From ancient Greek thinkers to modern existentialism, develop critical thinking and analytical skills.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Philosophy"),
    slug: "philosophy",
    title: "Philosophy",
  },
  {
    description:
      "Learn to play guitar from scratch. Covers chords, strumming patterns, fingerpicking, music theory, and popular songs across various genres.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Guitar for Beginners"),
    slug: "guitar-for-beginners",
    title: "Guitar for Beginners",
  },
  {
    description:
      "Develop essential public speaking skills. Learn to structure presentations, engage audiences, overcome stage fright, and communicate with confidence.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Public Speaking"),
    slug: "public-speaking",
    title: "Public Speaking",
  },
  {
    description:
      "Introduction to psychology covering cognition, behavior, development, social interactions, and mental health. Understand how the human mind works.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Psychology 101"),
    slug: "psychology-101",
    title: "Psychology 101",
  },
  {
    description:
      "Learn calculus from limits and derivatives to integrals and series. Build a strong mathematical foundation for science and engineering fields.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Calculus"),
    slug: "calculus",
    title: "Calculus",
  },
  {
    description:
      "Master the art of creative writing. Learn storytelling techniques, character development, dialogue, and how to craft compelling narratives.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Creative Writing"),
    slug: "creative-writing",
    title: "Creative Writing",
  },
  {
    description:
      "Understand climate science and environmental challenges. Learn about ecosystems, sustainability, renewable energy, and how to address climate change.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Environmental Science"),
    slug: "environmental-science",
    title: "Environmental Science",
  },
  {
    description:
      "Learn UI/UX design principles and modern design tools. Create user-centered interfaces, wireframes, prototypes, and conduct usability testing.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("UI/UX Design"),
    slug: "ui-ux-design",
    title: "UI/UX Design",
  },
  {
    description:
      "Explore world history from ancient civilizations to modern times. Understand key events, movements, and figures that shaped our world.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("World History"),
    slug: "world-history",
    title: "World History",
  },
  {
    description:
      "Master personal finance including budgeting, investing, retirement planning, and debt management. Build wealth and achieve financial independence.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Personal Finance"),
    slug: "personal-finance",
    title: "Personal Finance",
  },
  {
    description:
      "Learn Japanese from basic hiragana and katakana to conversational fluency. Covers grammar, vocabulary, kanji, and cultural context.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Japanese Language"),
    slug: "japanese-language",
    title: "Japanese Language",
  },
  {
    description:
      "Introduction to biology covering cells, genetics, evolution, ecology, and human anatomy. Understand the fundamental principles of life.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Biology Essentials"),
    slug: "biology-essentials",
    title: "Biology Essentials",
  },
  {
    description:
      "Comprehensive overview of legal systems, jurisprudence, and the foundations of law. Understand how laws are created, interpreted, and enforced.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Law"),
    slug: "law",
    title: "Law",
  },
  {
    description:
      "Study criminal law including offenses, defenses, and the criminal justice system. Learn about prosecution, evidence, and constitutional protections.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Criminal Law"),
    slug: "criminal-law",
    title: "Criminal Law",
  },
  {
    description:
      "Master tax law principles including income taxation, deductions, credits, and tax planning strategies for individuals and businesses.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Tax Law"),
    slug: "tax-law",
    title: "Tax Law",
  },
  {
    description:
      "Learn civil law covering contracts, property, torts, and family law. Understand legal rights and remedies in non-criminal disputes.",
    imageUrl: null,
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString("Civil Law"),
    slug: "civil-law",
    title: "Civil Law",
  },

  // Portuguese courses
  {
    description:
      "Machine learning permite que computadores identifiquem padrões e façam previsões a partir de dados. Cobre técnicas supervisionadas e não supervisionadas, redes neurais e avaliação de modelos. Prepara você para trabalhar como engenheiro de machine learning em empresas de tecnologia, laboratórios de pesquisa ou startups.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/machine_learning-jmaDwiS0MptNV2EGCZzYWU7RBJs3Qg.webp",
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Machine Learning"),
    slug: "machine-learning",
    title: "Machine Learning",
  },
  {
    description:
      "Domínio do espanhol desde iniciante (A1) até avançado (C2), cobrindo conversação, leitura, escrita e compreensão auditiva. Permite comunicação em contextos pessoais e profissionais em países de língua espanhola.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/spanish-G8NTOu5F2vUzMSaJ7oa2hgKrzAQtGr.webp",
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Espanhol"),
    slug: "espanhol",
    title: "Espanhol",
  },
  {
    description:
      "Astronomia estuda objetos celestes, fenômenos espaciais e a estrutura do universo. Cobre planetas, estrelas, galáxias, buracos negros e cosmologia desde técnicas observacionais até frameworks teóricos.",
    imageUrl:
      "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/courses/astronomy-OfBov0VHGQPk98amhfAPg4UVrJH114.webp",
    isPublished: false,
    language: "pt",
    normalizedTitle: normalizeString("Astronomia"),
    slug: "astronomia",
    title: "Astronomia",
  },
  {
    description:
      "Domine a programação Python desde os fundamentos até conceitos avançados. Aprenda sintaxe, estruturas de dados, funções, programação orientada a objetos e construa aplicações reais.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Programação Python"),
    slug: "programacao-python",
    title: "Programação Python",
  },
  {
    description:
      "Construa aplicações web modernas com HTML, CSS, JavaScript e frameworks populares. Aprenda desenvolvimento frontend e backend, APIs e estratégias de deploy.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Desenvolvimento Web"),
    slug: "desenvolvimento-web",
    title: "Desenvolvimento Web",
  },
  {
    description:
      "Analise e interprete dados complexos usando métodos estatísticos e ferramentas de visualização. Aprenda manipulação de dados, análise exploratória e aplicações de machine learning.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Ciência de Dados"),
    slug: "ciencia-de-dados",
    title: "Ciência de Dados",
  },
  {
    description:
      "Aprenda os fundamentos da economia incluindo microeconomia, macroeconomia, estruturas de mercado e política econômica. Entenda como as economias funcionam e tome decisões financeiras informadas.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Introdução à Economia"),
    slug: "introducao-a-economia",
    title: "Introdução à Economia",
  },
  {
    description:
      "Domine a fotografia digital desde o básico da câmera até técnicas avançadas de composição. Aprenda iluminação, pós-processamento e desenvolva sua visão artística.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Fotografia Digital"),
    slug: "fotografia-digital",
    title: "Fotografia Digital",
  },
  {
    description:
      "Entenda os princípios da nutrição e como a alimentação afeta sua saúde. Aprenda sobre macronutrientes, micronutrientes, planejamento de refeições e diretrizes alimentares baseadas em evidências.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Fundamentos de Nutrição"),
    slug: "fundamentos-de-nutricao",
    title: "Fundamentos de Nutrição",
  },
  {
    description:
      "Explore a história e técnicas da filosofia ocidental. Dos pensadores gregos antigos ao existencialismo moderno, desenvolva pensamento crítico e habilidades analíticas.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Filosofia"),
    slug: "filosofia",
    title: "Filosofia",
  },
  {
    description:
      "Aprenda a tocar violão do zero. Cobre acordes, padrões de batida, dedilhado, teoria musical e músicas populares de vários gêneros.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Violão para Iniciantes"),
    slug: "violao-para-iniciantes",
    title: "Violão para Iniciantes",
  },
  {
    description:
      "Desenvolva habilidades essenciais de oratória. Aprenda a estruturar apresentações, engajar audiências, superar o medo de palco e comunicar-se com confiança.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Oratória"),
    slug: "oratoria",
    title: "Oratória",
  },
  {
    description:
      "Introdução à psicologia cobrindo cognição, comportamento, desenvolvimento, interações sociais e saúde mental. Entenda como a mente humana funciona.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Psicologia"),
    slug: "psicologia",
    title: "Psicologia",
  },
  {
    description:
      "Aprenda cálculo desde limites e derivadas até integrais e séries. Construa uma base matemática sólida para áreas de ciência e engenharia.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Cálculo"),
    slug: "calculo",
    title: "Cálculo",
  },
  {
    description:
      "Domine a arte da escrita criativa. Aprenda técnicas de narrativa, desenvolvimento de personagens, diálogos e como criar histórias envolventes.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Escrita Criativa"),
    slug: "escrita-criativa",
    title: "Escrita Criativa",
  },
  {
    description:
      "Entenda a ciência do clima e os desafios ambientais. Aprenda sobre ecossistemas, sustentabilidade, energia renovável e como enfrentar as mudanças climáticas.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Ciências Ambientais"),
    slug: "ciencias-ambientais",
    title: "Ciências Ambientais",
  },
  {
    description:
      "Aprenda princípios de design UI/UX e ferramentas modernas de design. Crie interfaces centradas no usuário, wireframes, protótipos e conduza testes de usabilidade.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Design UI/UX"),
    slug: "design-ui-ux",
    title: "Design UI/UX",
  },
  {
    description:
      "Explore a história mundial das civilizações antigas até os tempos modernos. Entenda eventos-chave, movimentos e figuras que moldaram nosso mundo.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("História Mundial"),
    slug: "historia-mundial",
    title: "História Mundial",
  },
  {
    description:
      "Domine finanças pessoais incluindo orçamento, investimentos, planejamento de aposentadoria e gestão de dívidas. Construa riqueza e alcance independência financeira.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Finanças Pessoais"),
    slug: "financas-pessoais",
    title: "Finanças Pessoais",
  },
  {
    description:
      "Aprenda inglês do básico à fluência conversacional. Cobre gramática, vocabulário, pronúncia e contexto cultural para comunicação eficaz.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Inglês"),
    slug: "ingles",
    title: "Inglês",
  },
  {
    description:
      "Introdução à biologia cobrindo células, genética, evolução, ecologia e anatomia humana. Entenda os princípios fundamentais da vida.",
    imageUrl: null,
    isPublished: true,
    language: "pt",
    normalizedTitle: normalizeString("Biologia"),
    slug: "biologia",
    title: "Biologia",
  },
];

const testOrgCoursesData = [
  {
    description: "A course from test-org that should not appear in ai org.",
    imageUrl: null,
    isPublished: false,
    language: "en",
    normalizedTitle: normalizeString("Test Org Course"),
    slug: "test-org-course",
    title: "Test Org Course",
  },
];

export async function seedCourses(
  prisma: PrismaClient,
  orgs: SeedOrganizations,
): Promise<void> {
  await Promise.all([
    ...coursesData.map((course) =>
      prisma.course.upsert({
        create: {
          organizationId: orgs.ai.id,
          ...course,
        },
        update: {},
        where: {
          orgSlug: {
            language: course.language,
            organizationId: orgs.ai.id,
            slug: course.slug,
          },
        },
      }),
    ),
    ...testOrgCoursesData.map((course) =>
      prisma.course.upsert({
        create: {
          organizationId: orgs.testOrg.id,
          ...course,
        },
        update: {},
        where: {
          orgSlug: {
            language: course.language,
            organizationId: orgs.testOrg.id,
            slug: course.slug,
          },
        },
      }),
    ),
  ]);
}
