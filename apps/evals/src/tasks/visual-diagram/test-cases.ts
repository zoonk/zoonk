const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. NODE QUALITY: Node labels should be clear (max 30 chars) and use the description's exact wording when it fits. Do not add qualifiers or synonyms not in the description.

2. EDGE DIRECTION: Edges use "from" (the actor — who does the action) and "to" (the receiver). Evaluate whether the direction is correct for the described relationship. For example, "A reads from B" should be from=A, to=B (A is the actor).

3. EDGE LABELS: Each edge label should describe a single action or relationship. Do NOT penalize for combining closely related actions on a single edge when only one connection exists between two nodes.

4. POST-PROCESSING: The output goes through post-processing where: node IDs are auto-generated from labels (the model only provides labels), "from"/"to" labels are resolved to "source"/"target" IDs, and orphan nodes are removed. The output you see has "id", "source", and "target" fields — this is expected. Do NOT penalize for having these fields instead of label-only nodes or "from"/"to" edges.

5. SCHEMA LIMITATIONS: The diagram schema only supports nodes and edges. Do NOT penalize for internal actions that cannot be represented as edges (e.g., "transforms data" is an internal process, not a connection). Do NOT penalize for reasonable interpretations of ambiguous spatial descriptions (e.g., "sits between" can be modeled in multiple valid ways).

6. NO POSITIONS: Output must NOT include x/y coordinates or position data.

7. FOCUS: 3-7 nodes for optimal clarity. If the description implies more, prioritize the most important relationships.

8. LANGUAGE: All text content (node labels, edge labels) must be in the specified language. Only JSON field names should be in English.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-network-request-flow",
    userInput: {
      description:
        "Diagram showing a web request flow: Client sends request to Load Balancer, which routes to one of two App Servers. Both App Servers connect to a shared Database. The Load Balancer also connects to a Cache layer that sits between it and the App Servers.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-data-pipeline",
    userInput: {
      description:
        "Diagram of a data pipeline: Raw Data feeds into an Ingestion Service, which writes to a Message Queue. A Processing Worker reads from the queue, transforms data, and writes to a Data Warehouse. A separate Monitoring Service watches the Processing Worker and sends alerts to an Alert Dashboard.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Brazilian Portuguese.
    `,
    id: "pt-fluxo-autenticacao",
    userInput: {
      description:
        "Diagrama do fluxo de autenticação: Usuário envia credenciais para o Servidor de Auth. O Servidor de Auth valida contra o Banco de Dados de Usuários. Se válido, gera um Token JWT e retorna ao Usuário. O Usuário usa o token para acessar a API, que valida o token com o Servidor de Auth.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: All content must be in Latin American Spanish.
    `,
    id: "es-cadena-suministro",
    userInput: {
      description:
        "Diagrama de cadena de suministro: Proveedor envía materias primas a la Fábrica. La Fábrica produce productos y los envía al Centro de Distribución. El Centro de Distribución despacha a tres Tiendas Minoristas. Cada Tienda Minorista también puede devolver productos al Centro de Distribución.",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-microservice-dependencies",
    userInput: {
      description:
        "Diagram showing microservice dependencies: API Gateway connects to User Service and Order Service. Order Service depends on Payment Service and Inventory Service. Payment Service connects to an External Payment Provider. All services connect to a shared Config Service.",
      language: "en",
    },
  },
];
