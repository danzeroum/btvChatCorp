export interface ProjectTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  defaultInstructions: string;
  suggestedClassifications: string[];
  sampleQuestions: string[];
  recommendedSettings: {
    temperature: number;
    maxTokens: number;
    topK: number;
  };
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'customer-support',
    name: 'Atendimento ao Cliente',
    icon: '🎧',
    description: 'IA para responder dúvidas de clientes com base em FAQ, manuais e políticas.',
    category: 'customer',
    defaultInstructions: `Você é o assistente virtual da {COMPANY_NAME}. Responda em português,
de forma educada e profissional. Baseie-se EXCLUSIVAMENTE nos documentos fornecidos.
Se não encontrar a informação, diga que não encontrou e sugira o suporte em {SUPPORT_EMAIL}.
NUNCA invente informações ou preços.`,
    suggestedClassifications: ['FAQ', 'Manual do Produto', 'Política de Trocas', 'Tabela de Preços', 'SLA'],
    sampleQuestions: [
      'Qual o prazo de entrega para São Paulo?',
      'Como faço para trocar um produto com defeito?',
      'Quais formas de pagamento vocês aceitam?',
    ],
    recommendedSettings: { temperature: 0.3, maxTokens: 1024, topK: 5 },
  },
  {
    id: 'document-analysis',
    name: 'Análise de Documentos',
    icon: '📄',
    description: 'IA para analisar, resumir e extrair informações de contratos e relatórios.',
    category: 'legal',
    defaultInstructions: `Você é um analista especializado em documentos da {COMPANY_NAME}.
Capacidades: resumir, extrair cláusulas, identificar riscos, comparar versões.
Sempre cite o documento e a seção/página. Nunca forneça aconselhamento jurídico — recomende validação com advogado.`,
    suggestedClassifications: ['Contrato', 'Aditivo', 'Relatório', 'Proposta', 'NDA', 'Regulamento'],
    sampleQuestions: [
      'Resuma os pontos principais deste contrato.',
      'Quais são as cláusulas de rescisão?',
      'Identifique riscos neste contrato.',
    ],
    recommendedSettings: { temperature: 0.2, maxTokens: 2048, topK: 8 },
  },
  {
    id: 'hr-knowledge-base',
    name: 'RH — Base de Conhecimento',
    icon: '👥',
    description: 'IA para responder dúvidas de colaboradores sobre políticas e benefícios.',
    category: 'hr',
    defaultInstructions: `Você é o assistente de RH da {COMPANY_NAME}.
Responda dúvidas sobre políticas, benefícios e procedimentos. Para questões disciplinares,
direcione ao gestor. NUNCA compartilhe informações de um colaborador com outro.`,
    suggestedClassifications: ['Política Interna', 'Manual do Colaborador', 'Plano de Benefícios', 'Código de Conduta'],
    sampleQuestions: [
      'Como faço para solicitar férias?',
      'Quais são os benefícios do plano de saúde?',
      'Qual o processo para trabalhar remotamente?',
    ],
    recommendedSettings: { temperature: 0.3, maxTokens: 1024, topK: 5 },
  },
  {
    id: 'legal-compliance',
    name: 'Jurídico & Compliance',
    icon: '⚖️',
    description: 'IA para consultar legislação, normas internas e auxiliar em compliance.',
    category: 'legal',
    defaultInstructions: `Você é o assistente jurídico da {COMPANY_NAME}.
SEMPRE inclua: "Esta informação é apenas referencial. Consulte o departamento jurídico."
Cite artigos de lei com precisão. Classifique riscos: CRÍTICO / ALTO / MÉDIO / BAIXO.`,
    suggestedClassifications: ['Legislação', 'Norma Interna', 'Parecer Jurídico', 'LGPD', 'Regulamento Setorial'],
    sampleQuestions: [
      'Quais os requisitos da LGPD para tratamento de dados sensíveis?',
      'Gere um checklist de compliance para o novo fornecedor.',
    ],
    recommendedSettings: { temperature: 0.1, maxTokens: 2048, topK: 10 },
  },
  {
    id: 'tech-support',
    name: 'Suporte Técnico — TI',
    icon: '🖥️',
    description: 'IA para auxiliar equipe de TI com troubleshooting e runbooks.',
    category: 'tech',
    defaultInstructions: `Você é o assistente de suporte técnico da {COMPANY_NAME}.
Para comandos, sempre mostre em bloco de código. SEMPRE alerte sobre comandos destrutivos.
Classifique severidade: P1 (crítico) / P2 (alto) / P3 (médio) / P4 (baixo).`,
    suggestedClassifications: ['Runbook', 'Documentação Técnica', 'SOP', 'Post-mortem', 'KB Article'],
    sampleQuestions: [
      'O servidor de produção está com CPU em 100%, o que verificar?',
      'Como fazer rollback do deploy no Kubernetes?',
    ],
    recommendedSettings: { temperature: 0.2, maxTokens: 2048, topK: 8 },
  },
  {
    id: 'business-intelligence',
    name: 'Business Intelligence',
    icon: '📊',
    description: 'IA para consultar dados, gerar insights e auxiliar em análises de negócio.',
    category: 'analytics',
    defaultInstructions: `Você é o analista de BI da {COMPANY_NAME}.
Interprete relatórios, identifique tendências e gere SQL quando solicitado.
Sempre cite a fonte e a data de referência. Para projeções, deixe claro que são estimativas.`,
    suggestedClassifications: ['Relatório Financeiro', 'Dashboard', 'KPI Report', 'Forecast', 'Análise Competitiva'],
    sampleQuestions: [
      'Qual foi o crescimento de receita no último trimestre?',
      'Compare o desempenho das regiões Sul e Sudeste.',
    ],
    recommendedSettings: { temperature: 0.3, maxTokens: 2048, topK: 8 },
  },
];
