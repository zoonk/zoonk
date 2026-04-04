const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. NODE QUALITY: Nodes must have unique, descriptive IDs (not "node1", "node2") and clear labels (max 30 chars). Node count should match what the description specifies — do not add extra nodes.

2. EDGE ACCURACY: Edges must faithfully represent the connections described. Source and target must reference valid node IDs. Edge labels are optional but should be used when the description specifies the nature of the connection.

3. NO POSITIONS: Output must NOT include x/y coordinates or position data — the frontend handles layout.

4. FOCUS: 3-7 nodes for optimal clarity. If the description implies more, prioritize the most important relationships.

5. LANGUAGE: All text content (node labels, edge labels) must be in the specified language. Only JSON field names should be in English.
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
