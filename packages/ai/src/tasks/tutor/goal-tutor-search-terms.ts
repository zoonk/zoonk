/**
 * A word here is the same for every learner, so it can never carry one learner's data. Matched
 * without case or accents, so each is written once, as it's spelled.
 */
const WORDS = [
  "a o as os um uma de da do das dos e em no na nos nas ao aos à às para pela pelo por com sem sobre entre após antes até ou que como qual quais quando onde ainda já mais menos se",
  "the of in on at to for and or a an is are was be with by from after before since until about not new",
  "el la los las un una del al y en por para con sin sobre entre tras hasta o que cómo cuál cuándo",
  "le la les un une des du de et en au aux pour par avec sans sur entre après avant",
  "der die das ein eine des dem den und oder in im am an auf für mit ohne nach vor seit",
  "direito direitos lei leis artigo artigos art arts inciso incisos parágrafo parágrafos alínea caput",
  "súmula súmulas vinculante jurisprudência entendimento tese teses tema temas repercussão geral",
  "decisão decisões julgamento julgado acórdão ministro ministros plenário turma recurso recursos",
  "extraordinário especial repetitivo repetitivos ação ações direta inconstitucionalidade constitucionalidade",
  "constitucional inconstitucional constituição federal estadual municipal código civil penal",
  "processo processual trabalho trabalhista tributário tributária administrativo administrativa",
  "empresarial comercial consumidor ambiental eleitoral previdenciário previdenciária internacional",
  "humanos ética estatuto regulamento regimento resolução provimento portaria instrução normativa",
  "decreto emenda medida provisória complementar ordinária revogação revogado revogada revogou",
  "alteração alterações alterado alterada alterou nova novo novas novos redação vigência vigente vigor",
  "atual atualizado atualizada atualização prazo prazos prescrição decadência competência",
  "contrato contratos cláusula cláusulas nula nulo nulidade válida válido validade",
  "honorários sucumbência sucumbenciais advocatícios contratuais advogado advogados advocacia",
  "sociedade empregado empregados empregador empregadores salário férias jornada rescisão demissão",
  "aviso prévio aposentadoria benefício benefícios servidor servidores público pública",
  "licitação licitações pregão contratação administração improbidade responsabilidade dano danos",
  "morais indenização família divórcio guarda alimentos herança sucessão testamento posse",
  "propriedade usucapião locação crime crimes pena penas prisão preventiva flagrante habeas corpus",
  "mandado segurança injunção imposto impostos tributo tributos isenção imunidade taxa contribuição",
  "concurso concursos edital editais banca prova provas fase fases exame questão questões gabarito",
  "inscrição inscrições cronograma data datas nota notas corte aprovação aprovados vagas cargo cargos",
  "conteúdo programático disciplina disciplinas matéria matérias peso pesos redação discursiva",
  "objetiva oficial resultado recursos regras regra",
  "law laws act acts article articles section sections clause clauses statute statutes regulation",
  "regulations rule rules ruling rulings court courts supreme decision decisions case cases precedent",
  "amendment amendments repeal repealed current latest update updated valid invalid contract",
  "contracts employee employer tax taxes federal state constitution constitutional",
  "exam exams test tests board syllabus notice date dates deadline registration score scores",
  "cutoff passing official requirements format section",
  "ley leyes artículo artículos decreto reforma derogación derogado vigente actual sentencia",
  "tribunal supremo constitucional jurisprudencia contrato examen convocatoria oposiciones temario",
  "fecha plazo requisitos",
] as const;

/** The words that name a reference, so a number right after one is the reference's own. */
const REFERENCE_WORDS = [
  "art arts artigo artigos inciso parágrafo § alínea lei leis lc decreto súmula tema temas emenda ec",
  "mp adi adc adpf ado re resp are hc ms rcl item questão",
  "article articles section rule case act amendment",
  "ley artículo",
] as const;

/** The words that name a law, so a law's number can follow them ("Lei 8.906/1994"). */
const LAW_WORDS = ["lei leis lc decreto emenda ec mp ley leyes law laws act acts"] as const;

const ACRONYMS = [
  "stf stj tst tse stm tcu tce trf trt tre tj cnj cnmp oab mpf pgr agu",
  "cf clt cpc cpp cp cc cdc ctn eca lindb lrf lc ec adi adc adpf ado re resp hc ms rcl",
  "enem sisu fies prouni inep mec fgv cebraspe cespe fcc vunesp ibfc quadrix iades",
  "inss fgts icms ipi iss iptu ipva irpf irpj pis cofins csll",
  "us usa uk eu un sat gre gmat lsat mcat ielts toefl dele delf dalf",
] as const;

/** A law's subdivisions are numbered in Roman numerals ("inciso IV"). */
const ROMAN_NUMERALS =
  "i ii iii iv v vi vii viii ix x xi xii xiii xiv xv xvi xvii xviii xix xx" as const;

export function normalizeSearchWord(word: string): string {
  return word.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase();
}

function toSet(lines: readonly string[]): ReadonlySet<string> {
  return new Set(lines.flatMap((line) => line.split(" ")).map((word) => normalizeSearchWord(word)));
}

export const SEARCH_TERMS = toSet([...WORDS, ...ACRONYMS, ROMAN_NUMERALS]);

export const SEARCH_REFERENCE_WORDS = toSet(REFERENCE_WORDS);

export const SEARCH_LAW_WORDS = toSet(LAW_WORDS);
