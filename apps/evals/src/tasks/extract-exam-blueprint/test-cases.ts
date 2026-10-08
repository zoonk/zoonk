import { type TestCase } from "@/lib/types";
import { type ExtractionEvalInput } from "./generate";
import { type ExtractionExpected } from "./task";

/**
 * Real notices with a current edition on 26 Sep 2026 (OAB, AP, IELTS and TOEFL
 * read on 27 Sep 2026, the SAT dates page on 30 Sep 2026). Facts were read by hand
 * from the same documents. education.gouv.fr refuses automated fetches, so the bac
 * case reads a secondary page that reproduces the official calendar.
 */
export const TEST_CASES: TestCase<ExtractionExpected, ExtractionEvalInput>[] = [
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 180 },
        { date: "2026-11-08", dateKind: "exam", kind: "date" },
        { date: "2026-11-15", dateKind: "exam", kind: "date" },
        { date: "2026-06-05", dateKind: "registrationEnd", kind: "date" },
        { kind: "subject", name: "Linguagens", questions: 45 },
        { kind: "subject", name: "Matemática", questions: 45 },
        { format: "multipleChoice", kind: "format" },
        { format: "essay", kind: "format" },
        { kind: "scoring", method: "itemResponseTheory" },
        { kind: "timeLimit", minutes: 330 },
        { kind: "timeLimit", minutes: 300 },
      ],
    },
    id: "enem-2026",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital Inep nº 64, de 21 de maio de 2026 (Enem 2026)",
          url: "http://www.abmes.org.br/arquivos/legislacoes/Edital-inep-064-2026-05-21.pdf",
        },
      ],
      exam: "ENEM",
    },
  },
  {
    expected: {
      facts: [
        { kind: "subject", name: "Ciências da Natureza e suas Tecnologias" },
        {
          kind: "topic",
          subject: "Ciências da Natureza e suas Tecnologias",
          topic: "Moléculas, células e tecidos",
        },
        {
          kind: "topic",
          subject: "Ciências da Natureza e suas Tecnologias",
          topic: "Hereditariedade e diversidade da vida",
        },
        {
          kind: "topic",
          subject: "Matemática e suas Tecnologias",
          topic: "Conhecimentos numéricos",
        },
        {
          kind: "topic",
          subject: "Ciências Humanas e suas Tecnologias",
          topic: "Diversidade cultural, conflitos e vida em sociedade",
        },
      ],
    },
    // The reference matrix's competências and habilidades are what the questions ask; its
    // "objetos de conhecimento" are what candidates study, so they're the topics.
    id: "enem-2026-matriz",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Matriz de Referência Enem",
          url: "https://download.inep.gov.br/download/enem/matriz_referencia.pdf",
        },
      ],
      exam: "ENEM",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 150 },
        { kind: "section", questions: 35 },
        { kind: "section", questions: 45 },
        { kind: "section", questions: 70 },
        { format: "trueFalse", kind: "format" },
        { kind: "scoring", method: "wrongCancelsRight" },
        { kind: "timeLimit", minutes: 240 },
        { date: "2026-11-22", dateKind: "exam", kind: "date" },
        { date: "2026-08-26", dateKind: "registrationStart", kind: "date" },
        { date: "2026-09-17", dateKind: "registrationEnd", kind: "date" },
      ],
    },
    id: "tcdf-2026",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – TCDF/ANACE, de 8 de julho de 2026",
          url: "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/arquivos/7971F586B9A9CE2C60801C731D8A1CD87F4C5136CA1F1E346C27C5C743773A73.pdf",
        },
      ],
      exam: "Concurso TCDF, Analista Administrativo de Controle Externo",
    },
  },
  {
    // The notice that lists every role's syllabus in the same document: the reading keeps the
    // role asked for, groups its subjects by test, and lists every numbered item and sub-item.
    expected: {
      facts: [
        { date: "2027-01-17", dateKind: "exam", kind: "date" },
        { format: "trueFalse", kind: "format" },
        { kind: "scoring", method: "wrongCancelsRight" },
        // P1 and P2 share one time: one section of both tests, 5 hours for 180 items.
        { kind: "section", minutes: 300, questions: 180 },
        { kind: "subject", name: "Língua Portuguesa" },
        { kind: "subject", name: "Linguística" },
        { kind: "subject", name: "Ciência Política" },
        { group: "P1", kind: "group", subject: "Língua Portuguesa" },
        { group: "P2", kind: "group", subject: "Linguística" },
        {
          kind: "topic",
          subject: "Língua Portuguesa",
          topic: "5.7 Emprego do sinal indicativo de crase",
        },
        {
          kind: "topic",
          subject: "Língua Portuguesa",
          topic: "6.4 Reescrita de textos de diferentes gêneros e níveis de formalidade",
        },
        {
          kind: "topic",
          subject: "Linguística",
          topic: "12 Noções básicas de lógica: conectivos, argumentos e notação",
        },
        {
          kind: "topic",
          subject: "Ciência Política",
          topic: "11 História do voto e dos partidos no Brasil",
        },
      ],
    },
    id: "camara-2026-registro-redacao",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital nº 1 – Câmara dos Deputados, de 2 de outubro de 2026",
          url: "https://cdn.cebraspe.org.br/concursos/CD_26_ANALISTA/arquivos/BBE30D016054F40651E36AC7B302C3425BD148A39675CA840A5A0CCBFBB5F0F1.pdf",
        },
      ],
      exam: "Câmara dos Deputados, Analista Legislativo – Registro e Redação",
    },
  },
  {
    expected: {
      facts: [
        { kind: "section", minutes: 300, questions: 80 },
        { format: "multipleChoice", kind: "format" },
        { kind: "scoring", method: "raw" },
        { kind: "timeLimit", minutes: 300 },
        { date: "2026-06-01", dateKind: "registrationStart", kind: "date" },
        { date: "2026-06-08", dateKind: "registrationEnd", kind: "date" },
        { date: "2026-09-06", dateKind: "exam", kind: "date" },
        { date: "2026-10-18", dateKind: "exam", kind: "date" },
        { date: "2026-12-03", dateKind: "results", kind: "date" },
      ],
    },
    id: "oab-47",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital de abertura do 47º Exame de Ordem Unificado",
          url: "https://s.oab.org.br/arquivos/2026/05/3578986c-fb9e-42ed-b68b-9a5131c86c9a.pdf",
        },
      ],
      exam: "47º Exame de Ordem Unificado (OAB)",
    },
  },
  {
    // The 1ª fase names its disciplines in one table cell (the last ones after "bem como") while
    // Anexo II details the 2ª fase's: a live reading on 8 Oct 2026 listed 19 subjects without
    // Ética, so the latest edition's counts (Ética 8…) couldn't be looked up for the 80 questions.
    expected: {
      facts: [
        { kind: "subject", name: "Ética" },
        { kind: "subject", name: "Direitos Humanos" },
        { kind: "subject", name: "Filosofia do Direito" },
        { kind: "subject", name: "Direito Eleitoral" },
        { kind: "subject", name: "Direito Civil" },
        { kind: "subject", name: "Direito Processual Penal" },
        { kind: "section", minutes: 300, questions: 80 },
        { format: "multipleChoice", kind: "format" },
        { date: "2027-01-10", dateKind: "exam", kind: "date" },
        { date: "2027-02-28", dateKind: "other", kind: "date" },
      ],
    },
    id: "oab-48-1a-fase",
    language: "pt",
    userInput: {
      documents: [
        {
          title: "Edital de abertura do 48º Exame de Ordem Unificado",
          url: "https://s.oab.org.br/arquivos/2026/09/fb43fb37-838e-4d33-a863-99fa1f98b921.pdf",
        },
      ],
      exam: "OAB Exame de Ordem Unificado, 1ª fase",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 98 },
        { kind: "section", minutes: 64, questions: 54 },
        { kind: "section", minutes: 70, questions: 44 },
        { kind: "timeLimit", minutes: 134 },
        { format: "multipleChoice", kind: "format" },
        { date: "2027-03-06", dateKind: "exam", kind: "date" },
        { date: "2027-02-19", dateKind: "registrationEnd", kind: "date" },
      ],
    },
    id: "sat",
    language: "en",
    userInput: {
      documents: [
        {
          title: "SAT Test Structure",
          url: "https://satsuite.collegeboard.org/sat/whats-on-the-test/structure",
        },
        {
          // Its dates are table rows: a row alone doesn't say which date is the test's.
          title: "SAT Suite Test Dates and Deadlines",
          url: "https://satsuite.collegeboard.org/sat/dates-deadlines",
        },
      ],
      exam: "SAT",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 48 },
        { kind: "section", minutes: 100, questions: 42 },
        { kind: "section", minutes: 90, questions: 6 },
        { kind: "timeLimit", minutes: 190 },
        { format: "multipleChoice", kind: "format" },
        { date: "2027-05-10", dateKind: "exam", kind: "date" },
      ],
    },
    id: "ap-calculus-ab-2027",
    language: "en",
    userInput: {
      documents: [
        {
          title: "AP Calculus AB: About the Exam",
          url: "https://apstudents.collegeboard.org/courses/ap-calculus-ab/assessment",
        },
        { title: "2027 AP Exam Dates", url: "https://apstudents.collegeboard.org/exam-dates" },
      ],
      exam: "AP Calculus AB 2027",
    },
  },
  {
    expected: {
      facts: [
        { kind: "timeLimit", minutes: 165 },
        { kind: "section", minutes: 30, questions: 40 },
        { kind: "section", minutes: 60, questions: 40 },
        { format: "essay", kind: "format" },
        { format: "oral", kind: "format" },
      ],
    },
    id: "ielts-academic",
    language: "en",
    userInput: {
      documents: [
        {
          title: "IELTS Academic test",
          url: "https://ielts.org/take-a-test/test-types/ielts-academic-test",
        },
        {
          title: "IELTS Academic test format in detail",
          url: "https://ielts.org/organisations/ielts-for-organisations/test-types/ielts-academic-test",
        },
      ],
      exam: "IELTS Academic",
    },
  },
  {
    expected: {
      facts: [
        { kind: "questionCount", value: 120 },
        { kind: "section", minutes: 30, questions: 50 },
        { kind: "section", minutes: 29, questions: 47 },
        { kind: "section", minutes: 23, questions: 12 },
        { kind: "section", minutes: 8, questions: 11 },
      ],
    },
    id: "toefl-ibt",
    language: "en",
    userInput: {
      documents: [
        {
          title: "TOEFL iBT Test Content and Structure",
          url: "https://www.ets.org/toefl/test-takers/ibt/about/content.html",
        },
      ],
      exam: "TOEFL iBT",
    },
  },
  {
    expected: {
      facts: [
        { date: "2027-04-27", dateKind: "exam", kind: "date" },
        { date: "2027-05-05", dateKind: "exam", kind: "date" },
        { date: "2027-04-30", dateKind: "exam", kind: "date" },
      ],
    },
    id: "abitur-bayern-2027",
    language: "de",
    userInput: {
      documents: [
        {
          title: "Prüfungen und Zeugnisse (Termine)",
          url: "https://www.km.bayern.de/termine/pruefungen-und-zeugnisse",
        },
      ],
      exam: "Abitur Bayern 2027",
    },
  },
  {
    expected: {
      facts: [
        { date: "2027-06-14", dateKind: "exam", kind: "date" },
        { date: "2027-06-15", dateKind: "exam", kind: "date" },
        { date: "2027-07-06", dateKind: "results", kind: "date" },
      ],
    },
    id: "bac-2027",
    language: "fr",
    userInput: {
      documents: [
        { title: "Dates du bac 2027", url: "https://www.letudiant.fr/bac/date-du-bac.html" },
      ],
      exam: "Baccalauréat général 2027",
    },
  },
  {
    expected: {
      facts: [
        { format: "shortAnswer", kind: "format" },
        { format: "essay", kind: "format" },
      ],
    },
    // A teacher's one-page notes for a class test, as a learner uploads them: the formats are only
    // announced in the last line (persona run, 7 Oct 2026, where one reading dropped both).
    id: "pt-class-notes-biologia-celular",
    language: "pt",
    userInput: {
      documents: [
        {
          text: 'BIOLOGIA - 1º ANO B - Prof.ª Juliana\nResumo pra prova de sexta (9/10): A CÉLULA\n\n1) Teoria celular\n- Todo ser vivo é formado por células (exceto vírus!)\n- A célula é a menor unidade da vida\n- Toda célula vem de outra célula (Virchow)\n- Hooke viu as "celas" na cortiça (1665)\n\n2) Procarionte x eucarionte\n- Procarionte: sem núcleo (DNA solto no citoplasma = nucleoide), sem organelas membranosas. Ex: bactérias\n- Eucarionte: núcleo com carioteca + organelas. Ex: animais, plantas, fungos, protozoários\n- As duas têm: membrana plasmática, citoplasma, ribossomos, DNA\n\n3) Membrana plasmática\n- Bicamada de fosfolipídios + proteínas (mosaico fluido)\n- Permeabilidade seletiva\n- Transporte passivo (sem gasto de ATP): difusão simples, difusão facilitada, osmose\n- Osmose: água vai do meio hipotônico (menos concentrado) para o hipertônico (mais concentrado)\n- Hemácia em água pura incha e estoura (hemólise); em solução muito salgada murcha\n- Transporte ativo: gasta ATP, contra o gradiente. Ex: bomba de sódio e potássio\n- Endocitose (fagocitose e pinocitose) e exocitose\n\n4) Organelas (CAI MUITO!!)\n- Mitocôndria: respiração celular, produz ATP\n- Cloroplasto: fotossíntese (só em plantas e algas)\n- Ribossomos: síntese de proteínas\n- RE rugoso: tem ribossomos, faz proteínas / RE liso: lipídios, desintoxicação\n- Complexo golgiense: modifica, empacota e secreta\n- Lisossomo: digestão intracelular\n- Vacúolo: grande na célula vegetal\n- Parede celular: célula vegetal (celulose)\n\n5) Núcleo\n- Carioteca (envoltório nuclear com poros)\n- Cromatina = DNA + proteínas\n- Nucléolo: produz ribossomos\n\n6) Vírus\n- Acelulares, só se reproduzem dentro de células (parasitas intracelulares obrigatórios)\n- Capsídeo de proteína + material genético (DNA ou RNA)\n- Antibiótico NÃO funciona contra vírus\n\nA prof disse: vai ter questão de completar a tabela das organelas e uma dissertativa sobre osmose!',
          title: "Resumo pra prova de biologia",
        },
      ],
      exam: "Prova de biologia (1º ano), a célula",
    },
  },
  {
    expected: {
      facts: [
        { format: "multipleChoice", kind: "format" },
        { format: "essay", kind: "format" },
      ],
    },
    id: "en-class-notes-ap-biology-unit-2",
    language: "en",
    userInput: {
      documents: [
        {
          text: "AP Biology - Mr. Daniels - Unit 2 review (test on Thursday)\n\n1. Cell size and surface area-to-volume ratio\n- Smaller cells exchange materials faster: higher SA:V\n- Calculate SA:V for a cube (side 1 cm vs 3 cm)\n\n2. Membrane structure\n- Phospholipid bilayer, fluid mosaic model\n- Cholesterol keeps the membrane fluid at low temperatures\n\n3. Membrane transport\n- Passive: simple diffusion, facilitated diffusion, osmosis\n- Tonicity: hypotonic, isotonic, hypertonic solutions\n- Active transport uses ATP (sodium-potassium pump)\n\n4. Compartmentalization\n- Endomembrane system: ER, Golgi, lysosomes\n- Endosymbiotic theory (mitochondria and chloroplasts)\n\nTest format: 20 multiple choice questions (four choices each) plus one free-response essay where you design an experiment on osmosis in potato cores. Calculators allowed.",
          title: "Unit 2 review",
        },
      ],
      exam: "AP Biology unit 2 test",
    },
  },
];
