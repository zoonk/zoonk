/** Answers built against the Cebraspe answer standards in `test-cases.ts`, with known aspect coverage and planted language errors, written by a different model family (Anthropic) than the default grader. */
export const POINTS_ANSWERS = {
  impactBoundary: `A avaliação de impacto é muito importante para as políticas públicas e os programas sociais, porque mostra se o dinheiro público esta sendo bem gasto. Sem ela, o governo não sabe se um programa funciona, e pode continuar investindo em ações que não trazem resultado para a população.

A primeira razão para avaliar é que os recursos são limitados, e é preciso aplicá-los onde geram mais benefícios. A avaliação também serve para melhorar os programas, pois mostra o que precisa ser mudado e permite que o gestor tome decisões com base em dados e não em opiniões.

Os resultados de um programa depende muito do contexto socioeconômico da região onde ele é aplicado, pois uma mesma política pode funcionar bem em uma cidade rica e mal em uma cidade pobre, onde faltam empregos e serviços. Além disso, é importante comparar o impacto que se esperava, no momento em que o programa foi planejado, com o impacto que realmente aconteceu, para entender as diferenças.

Dentro da própria administração, a avaliação ajuda a planejar melhor e a gerir os programas, pois indica onde estão os problemas. Ela também permite fazer ajustes durante a execução, corrigindo erros antes que o programa termine e evitando desperdícios.

Existem duas formas principais de avaliação. A avaliação ex ante é feita antes do programa começar, com base em previsões, para decidir se ele vale a pena. A avaliação ex post é feita depois que o programa foi implementado, e mede os resultados que ele alcançou de fato.

Em suma, a avaliação de impacto é fundamental, e todos os órgãos deveria realizá-la, pois sem ela a administração publica não consegue saber o que funciona. Por isso, deve ser feita com seriedade e com profissionais qualificados, para que os resultados sejam confiáveis e posam ser usados.`,

  impactStrong: `A avaliação de impacto de políticas públicas e de programas sociais é indispensável a uma gestão pública orientada por evidências. Ela permite verificar se uma intervenção produziu os efeitos pretendidos, a que custo e para quem, o que fundamenta decisões sobre manter, corrigir ou encerrar um programa.

Deve-se avaliar o impacto, em primeiro lugar, porque os recursos públicos são escassos e precisam ser aplicados onde geram maior benefício social; sem medir os efeitos, o gestor decide às cegas. A avaliação serve, ainda, para aprimorar o desenho das políticas, para prestar contas à sociedade e para orientar a criação de novas intervenções. Quanto ao momento, ela deve acompanhar todo o ciclo da política, e não apenas o seu fim, pois só assim permite ajustes a tempo.

Os efeitos de um programa dependem do contexto socioeconômico em que ele é aplicado: uma transferência de renda, por exemplo, tem resultados distintos em regiões com mercado de trabalho dinâmico e em regiões estagnadas. Também as características do público-alvo, como escolaridade, faixa etária e acesso a serviços, alteram os resultados. Por isso, cabe comparar o impacto potencial, previsto no desenho, com o impacto efetivo, observado após a execução, e investigar as causas das diferenças. Nesse sentido, a avaliação funciona como método de monitoramento contínuo, que alimenta o gestor com informações ao longo da execução.

No âmbito interno, a avaliação permite à administração refinar o planejamento e a gestão, uma vez que revela gargalos e efeitos inesperados e possibilita a correção de rumos durante a execução, sem esperar até ao término do programa. No âmbito externo, os resultados interessam ao Poder Legislativo, que os utiliza para discutir orçamento e alterações legais, e aos órgãos de controle, que verificam a efetividade do gasto. A comunidade acadêmica, por sua vez, aproveita as evidências para produzir pesquisas que subsidiam políticas semelhantes em outros contextos.

Quanto aos métodos, destacam-se os experimentos controlados aleatorizados e as técnicas quase experimentais, como a regressão e o pareamento de grupos. A avaliação ex ante, feita antes da implementação, baseia-se em projeções e análises de custo-benefício para decidir sobre a adoção do programa; a avaliação ex post, feita após a implementação, mede os resultados efetivamente alcançados. Há três momentos cruciais para avaliar: antes da implementação, para informar o desenho; durante a execução, para monitorar e corrigir; e depois da conclusão, para verificar os resultados e a sua permanência.

Portanto, a avaliação de impacto não é um custo adicional, mas uma condição para que as políticas públicas cumpram os objetivos para os quais foram criadas e para que hajam ganhos de eficiência e de equidade. Seus resultados, quando divulgados, reforça a transparência e a confiança da sociedade no Estado.`,

  realBoundaryFail: `A inflação foi um dos maiores problemas da economia brasileira nas décadas de 1980 e 1990, e o governo tentou várias formas de controlá-la.

Os instrumentos heterodoxos atuam diretamente sobre os preços, como no congelamento de preços e de tarifas públicas, sem mexer no nível de atividade. Já os instrumentos ortodoxos agem de forma indireta, pois a alta dos juros diminui o consumo e o investimento, e a menor procura faz os preços subirem menos.

O Plano Real teve três etapas muito importante para a economia, e cada uma delas contribuiu para o sucesso do plano. Depois dessas etapas, a inflação caiu bastante e o país passou a ter uma moeda mais forte e estável, o que foi muito bom para a populaçao.

Portanto, o controle da inflação é essencial para o crescimento do país.`,

  realBoundaryPass: `Antes do Plano Real, o país teve vários planos econômicos, como o Cruzado e os planos Collor, que congelaram preços e não deram certo porque o governo continuou gastando mais do que arrecadava. O excesso de gasto público era um dos problema que alimentavam a inflação, e esses planos não atacaram essa causa.

Depois do Real, a inflação baixou, mas o déficit apareceu com mais clareza, porque o governo não podia mais contar com a inflação para corroer suas despesas. Por isso, concerteza foi necessário criar regras fiscais, como a Lei de Responsabilidade Fiscal, em 2000, e a meta de superávit primário.

Há também instrumentos heterodoxos e ortodoxos, que são formas diferentes de combater a inflação.

Na primeira etapa do plano, o governo fez um ajuste fiscal com o Programa de Ação Imediata e o Fundo Social de Emergência, para reduzir gastos e dar flexibilidade às receitas da União. Na segunda etapa, o governo criou a URV, em março de 1994, para que os preços se ajustasse a uma unidade de valor corrigida diariamente, o que eliminou a inércia inflacionária. Na terceira etapa, atravéz da nova moeda, o real, lançada em julho de 1994, o governo fixou a paridade com o dólar e limitou a emissão de moeda.

Assim, o Plano Real mostrou que a inflação tinha muitas causa e que o controle fiscal é indispensável.`,

  realFullClean: `Antes do Plano Real, o Brasil passou por sucessivos planos de estabilização, como o Cruzado, o Bresser, o Verão e os dois planos Collor, que se apoiaram em congelamentos de preços e fracassaram porque não enfrentaram o déficit público, uma das causas centrais da inflação. Após a implantação do Real, o desequilíbrio fiscal se tornou evidente com o fim do imposto inflacionário, o que levou à meta de superávit primário no tripé macroeconômico, em 1999, e à Lei de Responsabilidade Fiscal, em 2000.

Os instrumentos heterodoxos atuam diretamente sobre os preços, por meio do congelamento de preços, de tarifas públicas e do câmbio. Os ortodoxos, por sua vez, agem de forma indireta: a elevação da taxa de juros reduz o consumo e o nível de atividade, o que contém a alta dos preços.

O Plano Real foi implantado em três etapas. A primeira promoveu o ajuste fiscal por meio do Programa de Ação Imediata, de 1993, que visava o corte de gastos, e do Fundo Social de Emergência, que deu à União maior liberdade no uso de suas receitas. A segunda criou a Unidade Real de Valor, em março de 1994, que serviu à desindexação da economia até à chegada da nova moeda. A terceira introduziu o real, em 1º de julho de 1994, com paridade cambial e limites à emissão monetária.

Assim, a estabilização dependeu tanto da reforma monetária quanto do controle das contas públicas.`,

  realFullFourErrors: `Antes do Plano Real, houveram sucessivos planos de estabilização, como o Cruzado, o Bresser, o Verão e os dois planos Collor, e todos se apoiaram em congelamentos de preços. Essa estratégia fracassou, sem excessão, porque não enfrentou o déficit público, uma das causas centrais da inflação. Após a implantação do Real, o fim do imposto inflacionário deixou o desequilíbrio fiscal à mostra, o que levou à meta de superávit primário no tripé macroeconômico, em 1999, e à Lei de Responsabilidade Fiscal, em 2000.

Os instrumentos heterodoxos atuam diretamente sobre os preços, por meio do congelamento de preços, de tarifas públicas e do câmbio. Os ortodoxos, por sua vez, agem de forma indireta: a elevação da taxa de juros reduz o consumo e o nível de atividade, o que contém a alta dos preços.

O Plano Real foi implantado em três etapas. A primeira promoveu o ajuste fiscal por meio do Programa de Ação Imediata, de 1993, voltado ao corte de gastos, e do Fundo Social de Emergência, que deu à União maior liberdade no uso de suas receitas. A segunda criou a Unidade Real de Valor, à partir de março de 1994, que serviu à desindexação da economia. A terceira introduziu o real, em 1º de julho de 1994, com paridade cambial e limites à emissão monetária, medidas que se mostrou decisivas.

Assim, a estabilização dependeu tanto da reforma monetária quanto do controle das contas públicas.`,

  realOffTopic: `A Lei Geral de Proteção de Dados Pessoais, de 2018, estabelece regras para o tratamento de dados pessoais por pessoas físicas e jurídicas, de direito público ou privado, com o objetivo de proteger a liberdade e a privacidade dos cidadãos.

Entre os seus fundamentos estão o respeito à privacidade, a autodeterminação informativa e a inviolabilidade da intimidade. A lei exige uma base legal para cada tratamento, como o consentimento do titular ou o cumprimento de obrigação legal.

A Autoridade Nacional de Proteção de Dados fiscaliza o cumprimento da lei e pode aplicar sanções, como advertências e multas. Assim, a lei aproxima o Brasil dos padrões internacionais de proteção de dados.`,

  realWeakShort: `O Plano Real foi criado em 1994 para acabar com a inflação, que era muito alta no Brasil. Antes dele, outros planos tentaram controlar os preços, mas não deram certo. O plano teve etapas e criou uma nova moeda, o real, que existe até hoje e ajudou muito a economia.`,

  realWrongFacts: `Antes do Plano Real, o Brasil passou por sucessivos planos de estabilização, como o Cruzado, o Bresser, o Verão e os dois planos Collor, que se apoiaram em congelamentos de preços e fracassaram porque não enfrentaram o déficit público, uma das causas centrais da inflação. Depois do Real, o equilíbrio das contas deixou de ser uma preocupação, já que a moeda estável resolveu sozinha o problema fiscal.

Os instrumentos heterodoxos são aqueles que controlam a inflação de forma indireta, pela alta da taxa de juros, que reduz o consumo. Os ortodoxos, ao contrário, atuam diretamente sobre os preços, por meio do congelamento de preços e de tarifas.

O Plano Real foi implantado em três etapas. A primeira promoveu o ajuste fiscal por meio do Programa de Ação Imediata, de 1993, e do Fundo Social de Emergência, que deu à União maior liberdade no uso de suas receitas. A segunda lançou a nova moeda, o real, em 1994. A terceira criou a Unidade Real de Valor, em 1995, para corrigir os preços depois da troca da moeda.

Assim, a estabilização dependeu principalmente da reforma monetária.`,
};

/** Redações from Enem 2024, transcribed with their slips in Inep's "A redação no Enem 2025: cartilha do(a) participante". */
export const INEP_REDACOES = {
  anaClaraPereira: `O livro “Quarto de despejo”, de Carolina Maria de Jesus, retrata o cotidiano da própria autora — mulher negra e pobre —, que viveu na favela do Canindé, na década de 1960, em São Paulo. Conforme exibido na história de vida de Carolina e expandindo esse cenário para a realidade atual, infelizmente, ainda são perceptíveis desafios para a valorização da herança africana no Brasil. Assim, destacam-se o racismo estrutural e a negligência por parte da sociedade como aspectos dessa preocupante problemática em solo nacional.

O racismo estrutural, ou seja, o preconceito étnico enraizado na população, está muito presente nas relações sociais e na estrutura do Brasil. Isso porque o longo período escravocrata vivenciado no país e a não adoção de políticas de inserção dos libertos na sociedade deixaram cicatrizes irreversíveis na história brasileira, tais como a marginalização desse grupo, a menor taxa de acesso à escolarização e o menor salário desses indivíduos. Nesse sentido, segundo o filósofo Elijah Anderson, os brancos reduzem o espaço dos negros aos guetos — ambientes periféricos e desvalorizados pelos cidadãos em geral —, privando esses sujeitos de participarem de práticas eruditas, como o ensino superior e a atuação na política, o que impulsiona a desatenção quanto aos diversos legados das culturas africanas em território nacional. Dessa forma, o racismo estrutural constitui um obstáculo para a valorização dessa herança no país.

Além disso, a negligência da sociedade quanto à existência concreta desse preconceito é um grave desafio para a adoção de medidas que combatam tal desvalorização. Nesse contexto, apesar de inúmeros dados estatísticos comprovarem o desfavorecimento social desses indivíduos — como a informação do Atlas da Violência de 2019 de que quase 80% das vítimas de homicídio do ano foram negros —, muitas pessoas ainda persistem em acreditar que o preconceito racial não existe de fato. De acordo com o teórico Florestan Fernandes, a ideia de democracia racial brasileira é um mito, já que a convivência entre grupos étnicos no país foi, historicamente, marcada por violência, como a psicológica, a sexual e a física, ocorridas, principalmente, durante a escravidão — e impedindo o reconhecimento dos aspectos culturais dessas pessoas. Desse modo, a negligência por parte da população é um grande empecilho para a devida consideração do legado dessas comunidades no país.

Portanto, destacam-se o racismo estrutural e a negligência por parte da sociedade como desafios para a valorização da herança africana no Brasil. Logo, o Ministério da Educação — órgão federal responsável por coordenar as diretrizes do ensino na nação — deve criar um componente curricular voltado para a recuperação da cultura e da história africanas, por meio da criação de uma lei que implemente tal disciplina em todas as escolas do Brasil, a fim de reverter o atual quadro de desvalorização dessa etnia entre as próximas gerações. Ademais, o Ministério da Igualdade Racial deve promover campanhas que sinalizem a cotidiana presença dos preconceitos de cunho étnico, com o objetivo de conscientizar a população brasileira acerca da real existência dessa inquietante discriminação em solo nacional. Em última instância, busca-se, com tais medidas, alterar a situação de invisibilidade histórico-cultural ainda experienciada por brasileiros, a exemplo de Carolina Maria de Jesus.`,

  camilaDeSaoTiagoSilva: `A música “Bença”, do cantor e compositor Djonga, reflete criticamente, ao longo de seus versos, os empasses enfrentados por pessoas pretas na sociedade. Concomitantemente, é notório que a crítica feita pelo cantor destaca um problema social recorrente na realidade contemporânea, tendo em vista que cresce, na atual conjuntura brasileira, os desafios para a valorização da herança africana no Brasil. Nessa perspectiva, surge uma problemática agravante no país, que se potencializa, principalmente, devido ao legado histórico e à lacuna educacional.

Sob esse viés, é imprescindível destacar o legado histórico como agravador da falta de valorização da herança africana. Nesse sentido, a escravidão no Brasil, marco histórico nacional, foi movida e estruturada por uma série de preconceitos étnicos e raciais que, na época, evidenciaram a crença de superioridade dos europeus em relação aos povos nativos e africanos. Paralelamente, na sociedade brasileira atual, fica claro que as sequelas históricas do passado ainda têm efeito no presente, visto que a desvalorização da cultura negra e de sua herança é recorrente, tanto na série de representações esteriotipadas, quanto no contínuo apagamento de sua história.

Ademais, a lacuna educacional também impacta na problemática. Segundo o filósofo Immanuel Kant “O homem não é nada além daquilo que a educação faz dele”, compreendendo, dessa forma, a importância da educação na construção do ser humano. Entretanto, é fato que a crítica tecida por Kant não se concretiza na realidade, uma vez que a falta de atuação das instituições educacionais acomete o razo conhecimento acerca da origem afro-brasileira, bem como sua forte representação histórica e cultural no território nacional, o que desencadeia o desconhecimento sobre a importância de valorizá-la.

Conclui-se, portanto, que medidas devem ser tomadas para enfrentar os desafios para a valorização da herança africana no país. Por isso, cabe ao Ministério da Cultura, órgão responsável por garantir a valorização cultural no Brasil, assegurar que o legado afro-brasileiro seja devidamente reconhecido, por meio de políticas públicas e campanhas voltadas à cultura, para fins de promover maior inclusão social e étnica. Além disso, é dever do Ministério da educação, responsável por administrar os setores educacionais, dar maior visibilidade à história afrodescendente, por meio de atividades educativas e palestras pedagógicas voltadas às grandes personalidades negras do território nacional, para assim promover uma melhora do quadro no Brasil.`,

  pedroRicardoAlvesFreitas: `O Brasil, ao longo de sua história, tornou-se um país bastante miscigenado, sendo o povo africano um dos principais agentes na herança da identidade brasileira. Entretanto, com o passar dos anos, surgiram tentativas de desvalorizar essa descendência, como o surgimento do movimento Eugenista, que buscava embranquecer a população, pois acreditava-se que assim ela se tornaria mais pura e melhor. Dessa forma, infelizmente, fomentou-se uma visão negativa da herança negra, trazendo, para os dias de hoje, desafios para a valorização das origens africanas, tais como: a precária representatividade nas escolas e a falta de incentivos à cultura afrodescendente.

Nesse sentido, a representatividade escassa nas escolas acaba perpetuando estereótipos em relação à cultura africana, pois ela é pouco ensinada nos anos escolares e quando é abordada em sala de aula costuma ser apenas sobre o passado escravista, tratando os longos anos de sofrimento dos afrodescendentes, ou de um jeito estereotipado, resumindo a herança negra a poucos elementos como a capoeira, sem abordar sua diversidade. Assim, a educação cumpre um papel essencial na luta pela valorização da herança africana, pois desde cedo é preciso ensinar sobre a pluralidade da cultura negra às crianças e aos jovens; disseminando de forma adequada as origens africanas e transformando a sociedade, como afirmou Paulo Freire quando disse que, sem a educação, será impossível evoluirmos como sociedade.

Ademais, a falta de incentivos culturais aos afrodescendentes é um grande desafio, pois é muito difícil valorizar algo que não conhecemos. Dessa forma, é preciso destacar a ocorrência de casos como o que Djamila Ribeiro conta em seu livro, “Pequeno manual antirracista”, em que a autora relata ter consumido pouquíssimo conteúdo feito por pessoas negras em sua infância e, na maioria das vezes, observando apenas protagonistas brancos em livros., Nesse sentido, sem incentivos para artistas negros ocuparem espaços culturais, como livros ou filmes, apenas os brancos estarão sendo representados, privando as pessoas de contemplarem e valorizarem a cultura africana.

Portanto, cabe ao Ministério da Educação, órgão responsável por gerir os processos educacionais no Brasil, intensificar a representatividade negra nas escolas, por meio de uma reforma na base educacional, para trazer às aulas e aos livros didáticos a diversidade cultural negra para além da escravidão. Além disso, faz-se necessário que o Ministério da Cultura, órgão brasileiro responsável por gerir os meios culturais do país, destinar incentivos a artistas negros, a fim de fomentar a produção de conteúdo afrodescendente e disseminá-lo à população, por intermédio dos teatros, do cinema, da televisão e dos livros, suprimindo visões estereotipadas da sociedade.`,
};

export const LEVELS_ANSWERS = {
  cebraspeLai: `A Lei n.º 12.527/2011, conhecida como Lei de Acesso à Informação (LAI), regulamenta o direito constitucional de acesso a informações públicas e consagra a publicidade como regra e o sigilo como exceção.

A transparência ativa corresponde ao dever dos órgãos e das entidades públicas de divulgar, independentemente de requerimento, informações de interesse coletivo, como despesas, contratos e licitações, preferencialmente em seus sítios oficiais na internet. Já a transparência passiva ocorre quando o cidadão formula um pedido de acesso, que pode ser apresentado por qualquer interessado, sem necessidade de justificar os motivos da solicitação.

Quanto aos prazos, o órgão deve conceder o acesso imediato à informação disponível. Não sendo possível, terá até 20 dias para responder, prazo que pode ser prorrogado por mais 10 dias, mediante justificativa expressa ao requerente.

Por fim, a lei permite classificar como sigilosas as informações imprescindíveis à segurança da sociedade ou do Estado. Nesse caso, a informação ultrassecreta fica restrita por até 50 anos, a secreta por até 25 anos e a reservada por até 10 anos, podendo esses prazos ser renovados indefinidamente pela autoridade competente.

Dessa forma, a LAI fortalece o controle social e a participação cidadã na administração pública.`,

  oabConsumerRefund: `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE BELO HORIZONTE/MG

JOANA MARTINS, brasileira, solteira, professora, inscrita no CPF sob o n.º..., residente e domiciliada em Belo Horizonte/MG, por seu advogado, vem propor

AÇÃO DE RESTITUIÇÃO DE QUANTIA PAGA C/C INDENIZAÇÃO POR DANOS MATERIAIS

em face de CASA FRIA ELETRODOMÉSTICOS LTDA., pessoa jurídica de direito privado, inscrita no CNPJ sob o n.º..., com sede em Belo Horizonte/MG, pelos fatos e fundamentos a seguir.

I – DOS FATOS
A autora comprou da ré, em 5 de março de 2026, uma geladeira por R$ 4.000,00. Vinte dias depois, o aparelho parou de refrigerar. O produto foi levado à assistência técnica indicada pela loja em 26 de março e, até 15 de maio, o problema não foi resolvido. A ré se recusa a devolver o valor, alegando que a responsabilidade é do fabricante. A autora ainda perdeu alimentos no valor de R$ 600,00.

II – DO DIREITO
Trata-se de relação de consumo, pois a autora é consumidora e a ré é fornecedora.
O Código de Defesa do Consumidor, em seu art. 12, estabelece que o fabricante responde pelos danos causados por defeitos do produto. Embora o art. 13 diga que o comerciante responde apenas de forma subsidiária, no caso a loja deve responder porque vendeu o produto à autora.
Além disso, a autora teve prejuízo com os alimentos perdidos, que deve ser indenizado, conforme o art. 186 do Código Civil.

III – DOS PEDIDOS
Diante do exposto, requer:
a) a condenação da ré à devolução do valor de R$ 4.000,00;
b) a condenação da ré ao pagamento de R$ 600,00 pelos alimentos perdidos;
c) a condenação da ré ao pagamento de custas e honorários advocatícios.

Nestes termos, pede deferimento.
Belo Horizonte, data.
Advogado, OAB n.º...`,

  offTopicSocialMedia: `O uso das redes sociais por crianças cresce a cada ano no Brasil. Aplicativos de vídeos curtos e jogos on-line fazem parte da rotina de muitos estudantes antes mesmo dos dez anos de idade, o que levanta preocupações sobre a saúde mental e a segurança dessa geração.

Em primeiro lugar, a exposição precoce às telas afeta o desenvolvimento infantil. Crianças que passam muitas horas conectadas dormem menos, têm mais dificuldade de concentração e, muitas vezes, comparam a própria vida com imagens editadas de influenciadores, o que pode gerar ansiedade.

Além disso, o ambiente digital expõe os pequenos a riscos como o contato com desconhecidos e o acesso a conteúdos impróprios. O Estatuto da Criança e do Adolescente garante a proteção integral desse público, mas as plataformas ainda falham em verificar a idade dos usuários.

Portanto, o Ministério da Educação deve incluir a educação digital no currículo escolar, por meio de aulas semanais sobre o uso consciente da internet, a fim de proteger as crianças. Além disso, as famílias devem acompanhar o que os filhos acessam.`,
};

export const EN_ANSWERS = {
  classTestPhotosynthesis: `Photosynthesis takes place in the chloroplasts, where chlorophyll absorbs light energy. In the light-dependent reactions, that energy is used to split water, which releases oxygen, and to make ATP and NADPH.

In the Calvin cycle, the plant uses the ATP and NADPH to fix carbon dioxide into sugar. And it does this whether or not light is hitting the leaf at that moment, as long as ATP and NADPH are available.

If a plant is kept in the dark for a long time, it has to quickly use up its stored starch, because it can no longer make new sugar. Their growth then slows down.`,
};

export const OPENAI_ANSWERS = {
  impactAbove: `A prefeitura instituiu o auxílio-transporte para diminuir a evasão escolar. Como os recursos de educação são limitados, a avaliação de impacto ajuda a verificar se a despesa justifica a renúncia a outros usos do orçamento. Seu propósito é dar transparência ao investimento e prestar contas à população sobre o que a intervenção entrega. A mera comprovação dos pagamentos demonstra que os recursos saíram do caixa, mas não esclarece se os estudantes passaram a permanecer na escola.

A avaliação deve acompanhar o ciclo da iniciativa. Antes da implantação, ela ajuda a perguntar se o obstáculo de fato é o transporte; na execução, permite saber se o programa chega aos alunos; depois de concluída a intervenção, é possível investigar se ela produziu o resultado previsto. A escolha desses momentos tem consequências práticas. Se os gestores só procuram os registros quando o programa acaba, perdem a oportunidade de documentar a situação inicial das escolas.

Antes de iniciar os pagamentos, a secretaria deve registrar a frequência e os abandonos já observados para estabelecer a referência de partida. Durante a execução, pode apurar a proporção de alunos beneficiados que continua matriculada, conservando o mesmo critério de registro. Após a conclusão, deve levantar a evasão final, documentando o período em que ela foi observada. Na prática, essa documentação ajuda a preparar a avaliação sem confundir a data de pagamento com a data de saída da escola.

Importa, também, considerar as diferenças socioeconômicas. Em bairros onde o custo da passagem é elevado em relação à renda, uma ajuda de pequeno valor pode mudar a decisão familiar de manter o aluno matriculado. Em áreas com transporte coletivo barato, a mesma ajuda talvez faça menos diferença. A administração informou a sua equipe sobre essa hipótese, e o município preservou os registros dos bairros para que a informação pudesse ser examinada.

Internamente, o estudo serve para planejar a aplicação das verbas e gerir os recursos. A secretaria pode levar as conclusões à sua equipe de planejamento para estimar as despesas do próximo orçamento, por exemplo, se os bairros com deslocamentos caros exigirem um volume maior de recursos. Convém registrar quais dados sustentam essa decisão, para que a proposta de orçamento possa ser explicada ao público.

Em suma, avaliar o programa permite prestar contas de uma escolha orçamentária em condições que variam de uma localidade para outra. A avaliação precisa ser preparada ao longo da iniciativa e produzir evidências utilizáveis no planejamento municipal.`,
  impactBelow: `O auxílio-transporte municipal foi concebido para combater a evasão escolar. Avaliar seu impacto é necessário porque a receita disponível não cobre todas as demandas de educação. Cada valor destinado ao deslocamento deixa de financiar outra ação, e a secretaria precisa justificar essa escolha. A avaliação também deve permitir a prestação de contas à população, mostrando se o dinheiro produziu mudança na permanência de estudantes e oferecendo elementos para o debate sobre a prioridade atribuída ao programa.

O território pode alterar o resultado mesmo com desenho e valores iguais. Em uma zona urbana onde há linhas regulares, o auxílio pode cobrir a maior parte da viagem; em uma localidade rural, a renda é menor e a oferta de transporte é irregular. Ali, mesmo uma bolsa suficiente para pagar a passagem não resolve a ausência de serviço. A faixa etária também pesa: alunos mais jovens dependem com frequência de um adulto para acompanhá-los, enquanto adolescentes podem percorrer o trajeto sozinhos. Duas famílias com renda parecida podem, assim, ter necessidades diferentes.

O efeito do auxílio ainda pode ser maior quando ele coincide com a oferta de merenda. Pagar a viagem facilita a chegada, e a refeição na escola reduz o gasto familiar com alimentação naquele dia. Os benefícios se complementam no incentivo à permanência. Isolar a discussão do transporte das demais políticas educacionais esconderia essa interação, pois a mesma contribuição financeira pode ter consequências distintas segundo a oferta de refeições.

Os resultados têm uso interno para orientar decisões de planejamento e gestão. A secretaria pode levá-los até à sua equipe orçamentária para dimensionar o valor da bolsa no próximo plano. Em um prédio onde funcionam as equipes responsáveis pelas escolas rurais, o gestor pode reunir as estimativas de demanda e confrontá-las com os recursos cadastrados. Isso ajuda a escolher a alocação dos servidores e das verbas previstas, sobretudo onde a rede atende localidades de acesso mais difícil.

As conclusões interessam ao Legislativo municipal, que pode usá-las para discutir a dotação orçamentária e examinar a justificativa para as despesas. Os órgãos de controle podem usar os mesmos resultados para avaliar se o uso do dinheiro público foi eficaz. Assim, avaliar o auxílio ajuda a justificar uma escolha feita com recursos escassos e a explicar por que o resultado varia conforme o território, a idade dos estudantes e a presença de outras políticas.`,
  oabGivenName: `A) Sim. Por já ser maior de idade, Paulo pode retirar o segundo prenome, sem ter de provar o abandono. O próprio interessado deve formular o pedido sem motivação, na forma do art. 56, caput, da Lei nº 6.015/1973.

B) Não precisa ajuizar ação. Pode fazer a mudança imotivada pela via extrajudicial uma única vez.`,
  oabInheritance: `A) Paula não representa a mãe renunciante na sucessão de Joaquim, nos termos do art. 1.811 do Código Civil. A parte que caberia a Júlia acresce às de suas duas irmãs, que estão na mesma classe sucessória.

B) A renúncia não dispensa Júlia de trazer à colação a doação já recebida, conforme o art. 2.008 do Código Civil. Elena e Carla devem pedir no inventário que o juízo determine a colação do valor do imóvel na partilha.`,
  realAbove: `O Plano Real marcou uma inflexão no tratamento da inflação brasileira. Antes de sua implantação, planos como Cruzado e Bresser haviam fracassado porque não atacaram o déficit público. A persistência desse desequilíbrio tornava frágeis as tentativas de estabilização, ainda que os preços deixassem de subir durante algum tempo.

O combate heterodoxo passava pelo controle direto dos preços, como o congelamento de tarifas e de preços no varejo. Já o combate ortodoxo agia por meio da atividade econômica. A alta da taxa de juros, por exemplo, encarecia o crédito, reduzia o consumo e arrefecia a demanda. Um comerciante podia constatar o efeito no estabelecimento onde vendia a prazo, quando os clientes deixavam de financiar novas compras. O governo podia recorrer até à política de juros, e os consumidores reagiam por meio de suas escolhas de compra.

A avaliação da estratéjia exige distinguir o mecanismo de cada instrumento. Intervenções com efeitos superficiais não resolvem desequilíbrios duradouros. A equipe econômica teve de ratificar a previsão, ou seja, corrigir o erro na estimativa anterior. As medidas foi decisivas para expor o contraste entre as formas de atuação descritas. Em síntese, a leitura do período anterior ao Real mostra o limite de respostas que ignoravam as contas públicas. As medidas foi decisivas para revelar esse limite.`,
  realBelow: `A estabilização brasileira exigia distinguir o desequilíbrio das contas públicas dos mecanismos pelos quais os preços subiam. Antes do Plano Real, sucessivos planos de estabilização fracassaram porque não enfrentaram o déficit público. Congelar preços por decreto, como ocorreu no Plano Cruzado, era um recurso heterodoxo: o governo intervinha diretamente no preço cobrado. Logo que a tabela se tornava inviável, os reajustes voltavam.

No comércio, onde os consumidores sentiam de imediato a perda do poder de compra, a tabela podia interromper o aumento nominal por algum tempo. O governo anunciou limites, e os comerciantes tiveram de rever suas margens. A população assistiu ao retorno da inflação quando o congelamento deixou de corresponder aos custos. A medida se mostrou reversível, mesmo quando despertava expectativas favoráveis.

Nesse contexto, a primeira etapa do Real procurou enfrentar o desequilíbrio fiscal por meio do Programa de Ação Imediata e do Fundo Social de Emergência. O alcance dessas iniciativas deve ser avaliado com atenção à sua execução. Assim, a experiência anterior mostrou que suspender temporariamente os reajustes não dispensava o enfrentamento do déficit que punha em risco a estabilização.`,
  tjamInsurance: `Com a morte do pai, a mãe exerce sozinha o poder familiar, conforme o art. 1.631 do Código Civil, e administra os bens da filha menor por força do art. 1.689, II. Nessa condição, pode receber o capital em nome da beneficiária. Sem indício concreto de má gestão, cabe deferir o alvará. O recebimento integra a administração ordinária, sem exigir a demonstração de necessidade prevista no art. 1.691 para atos que ultrapassem esses limites. A retenção judicial nas condições propostas pelo Ministério Público restringiria indevidamente o exercício da administração.`,
};

export const ENEM_ZERO_ANSWERS = {
  almostFull: `Em muitas cidades, os pais recebem notícias sobre
vacinas pelo celular antes de poder conversar com
um profissional da saúde. Quando a origem dessas
mensagens é desconhecida, informações incorretas
podem orientar a decisão de adiar uma dose. O
problema exige acesso rápido a fontes confiáveis
e meios para reconhecer as mensagens enganosas.
Uma família pode encontrar no celular a alegação
de que a vacina altera o desenvolvimento infantil.
Mesmo quando o posto explica que a afirmação não
conta com evidência, a correção pode demorar a
chegar aos mesmos grupos. Quanto maior a demora,
maior o risco de os responsáveis desistirem de
procurar a unidade de saúde no dia agendado.
Também pesa a dificuldade de verificar as fontes.
Uma mensagem que imita um comunicado do governo
pode parecer convincente se traz imagens comuns
em campanhas oficiais. Ensinar a procurar a data
e o endereço da publicação ajuda o leitor a
comparar as informações antes de compartilhá-las.
Por isso, as secretarias municipais de saúde
devem manter um canal de mensagens que esclareça
boatos sobre vacinação, com profissionais das
unidades básicas respondendo às dúvidas no horário
de atendimento. As equipes podem divulgar o número
do canal nas escolas, junto de um guia breve com
exemplos de mensagens enganosas. Com uma resposta
disponível antes da consulta, mais famílias poderão
decidir com base em informações verificadas.`,

  original:
    "Quando escutam um boato, muitos pais adiam a vacina.\nA demora põe em risco também quem não pode se vacinar.\nÉ preciso aproximar as fontes oficiais dessas famílias.\nParte dos postos só esclarece dúvidas presencialmente.\nQuem mora longe fica sem resposta quando precisa.\nA UBS deve abrir um canal para tirar dúvidas.\nA enfermeira responde no horário das consultas.\nAssim, os pais decidem com informações verificadas.",

  support:
    "A cobertura vacinal caiu em diversos municípios.\nEntre famílias com crianças pequenas, circulam boatos.\nAs equipes de saúde orientam os moradores.\nHá dados de vacinação na internet.\nHá vacinas nas unidades públicas de saúde.\nA escola também pode ajudar a divulgar informações.\nUma fonte confiável pode mudar a decisão da família.\nO diálogo deve considerar as dúvidas locais.",

  tangent:
    "A vacinação infantil evita que doenças se espalhem.\nEm bairros distantes, chegar ao posto leva muito tempo.\nQuando a linha de ônibus é irregular, a viagem demora.\nMuitos responsáveis não conseguem sair do trabalho cedo.\nPor isso, a prefeitura deve oferecer ônibus aos sábados.\nOs veículos podem partir das escolas de cada bairro.\nAssim, mais famílias poderão levar os filhos ao posto.\nCom o acesso facilitado, a cobertura vacinal pode subir.",

  wrongForm:
    "Você ouviu falar da vacina, minha menina?\nA vizinha espalhou um boato no quintal.\nA enfermeira bateu o portão no fim do dia,\ne chamou para conversar no posto municipal.\nA mãe pegou o cartão e abriu a janela,\no céu sobre a rua já não era azul.\nA menina pegou duas fitas amarelas\ne atravessou a praça em direção ao sul.",
};

// Paragraph breaks restored at transitions in the Gemini output.
export const GEMINI_ANSWERS = {
  longAbove: `A estruturação de um programa municipal de auxílio-transporte com o objetivo central de mitigar a evasão escolar demanda um processo avaliativo sistemático, cuja razão de ser reside na escassez crônica de recursos orçamentários. Nesse cenário, avalia-se primariamente para prestar contas à sociedade e aos órgãos competentes sobre a eficácia da política pública implementada.

O sucesso da iniciativa é profundamente condicionado pelo contexto socioeconômico dos territórios atendidos, onde barreiras geográficas e vulnerabilidades locais afetam diretamente a frequência dos alunos. Do mesmo modo, as características do público-alvo, especialmente a idade dos estudantes, moldam a demanda por transporte e exigem critérios específicos no desenho operacional do programa.

É fundamental reconhecer que a política de transporte não opera no vácuo, existindo uma forte interação com programas correlatos, como o fornecimento de merenda escolar, cuja complementação nutricional atua conjuntamente na retenção do aluno.

Operacionalmente, o uso interno das evidências geradas serve para subsidiar o planejamento estratégico e a gestão cotidiana da secretaria, permitindo a otimização de rotas e a correção tempestiva de gargalos logísticos.

Ademais, os achados da avaliação cumprem papel relevante no uso externo, fornecendo subsídios técnicos indispensáveis para o Legislativo e órgãos de controle na fiscalização da aplicação dos recursos, bem como para a comunidade acadêmica em pesquisas que analisam a replicação e a aplicação a políticas semelhantes em outros contextos.

Concluindo, a avaliação rigorosa do auxílio-transporte transcende o mero controle gerencial, consolidando-se como ferramenta indispensável para a transparência democrática, o controle institucional e o aprimoramento contínuo de políticas públicas voltadas à permanência escolar.`,
  longBelow: `A implementação de um programa municipal de auxílio-transporte voltado para a redução da evasão escolar exige o desenvolvimento de uma avaliação rigorosa, cuja justificativa primordial fundamenta-se na escassez de recursos públicos. Diante de orçamentos limitados, torna-se imprescindível avaliar para prestar contas à sociedade sobre o uso adequado do dinheiro público e a efetividade da política de mobilidade estudantil.

O contexto socioeconômico dos territórios vulneráveis onde residem os alunos exerce forte influência sobre o sucesso da iniciativa, pois longas distâncias e precariedade viária intensificam o risco de abandono escolar. Além disso, as características do público-alvo, como a faixa etária dos estudantes, determinam necessidades específicas de deslocamento que devem ser consideradas no desenho do programa.

A eficácia do auxílio-transporte também não ocorre isoladamente, sofrendo forte interação com outros programas sociais, a exemplo do fornecimento de merenda escolar, cuja presença sinérgica potencializa a permanência do aluno na escola.

No âmbito da gestão, o uso interno dos resultados da avaliação mostra-se indispensável para gestores municipais planejarem e gerirem melhor os recursos logísticos, ajustando rotas e cadastros de beneficiários conforme as demandas reais identificadas.

Concluindo, avaliar o programa de auxílio-transporte não constitui mera formalidade burocrática, mas um instrumento essencial para otimizar a alocação de recursos escassos em contextos territoriais complexos, assegurando que o apoio estatal chegue efetivamente aos estudantes em idade escolar vulneráveis à evasão, em perfeita articulação com as demais políticas educacionais do município.`,
  shortAbove: `A compreensão da dinâmica inflacionária brasileira exige analisar o papel central do déficit público, visto que os planos econômicos anteriores ao Real ruíram essencialmente por não combaterem a raiz fiscal do problema. A insistência em ignorar o desequilíbrio das contas públicas impedia qualquer estabilização duradoura, cenário que se transformou após o Plano Real, quando o déficit passou a ser exposto de forma transparente, exigindo a adoção estrutural de superávits primários e a posterior consolidação institucional promovida pela Lei de Responsabilidade Fiscal.

Para enfrentar esse quadro complexo, a política econômica dispõe de instrumentos ortodoxos, que afetam a atividade econômica de maneira indireta por meio da restrição da demanda agregada, a exemplo da elevação drástica da taxa de juros e do controle rigoroso da base monetária. Paralelamente, o combate à inflação inercial exigiu inovações institucionais de caráter singular, materializadas na criação da Unidade Real de Valor em março de 1994, que serviu como indexador neutro para realinhar os preços relativos e desindexar a economia antes do lançamento da nova moeda.

Em conclusão, a articulação entre o saneamento das contas públicas, o manejo ortodoxo da política monetária e a neutralização da inércia inflacionária via URV constituiu a base sólida que finalmente garantiu a estabilidade de preços no Brasil, superando o fracasso histórico dos experimentos anteriores.`,
  shortBelow: `A introdução deste tema requer compreender que a trajetória inflacionária brasileira anterior ao Plano Real esteve intrinsecamente ligada à incapacidade crônica dos governos em estancar o déficit público. Diversos planos de estabilização implementados na década de 1980 e no início de 1990 fracassaram porque atacavam apenas os sintomas superficiais da inflação inercial, negligenciando o desequilíbrio fiscal estrutural que realimentava o processo inflacionário de maneira persistente e contínua. Sem um ajuste fiscal rigoroso que contidasse os gastos públicos excessivos, as tentativas de estabilização econômica mostravam-se efêmeras, ruindo logo após o esgotamento dos artifícios iniciais de controle de preços.

No que tange às ferramentas de combate à inflação, o instrumental heterodoxo diferencia-se por atuar diretamente sobre os preços nominais e os mecanismos de indexação da economia. As medidas heterodoxas utilizam-se de intervenções diretas do Estado, a exemplo do congelamento de preços, salários e tarifas públicas, buscando quebrar a memória inflacionária e a inércia que autoperpetuavam os reajustes.

Concluindo, embora tais medidas pudessem gerar um alívio momentâneo no custo de vida da população, a ausência de sustentabilidade fiscal garantia o retorno tempestivo do processo inflacionário, evidenciando que choques de preços sem disciplina fiscal representam apenas soluções paliativas e inócuas a médio e longo prazos.`,
};
