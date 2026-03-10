import { ProjectTemplate } from '../onboarding.model';

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'customer-support',
    name: 'Atendimento ao Cliente',
    icon: '📋',
    description: 'IA para responder dúvidas de clientes com base em FAQ, manuais e políticas.',
    category: 'customer',
    defaultInstructions: [
      {
        title: 'Comportamento geral do assistente',
        content: `Você é o assistente virtual da {COMPANY_NAME}. Seu objetivo é ajudar clientes com dúvidas sobre nossos produtos e serviços.

REGRAS:
- Sempre responda em português, de forma educada e profissional
- Baseie suas respostas EXCLUSIVAMENTE nos documentos fornecidos
- Se não encontrar a informação, diga: "Não encontrei essa informação na nossa base. Sugiro entrar em contato com nosso suporte em {SUPPORT_EMAIL}."
- NUNCA invente informações ou preços
- Cite a fonte quando possível`,
        triggerMode: 'always',
        priority: 1,
      },
    ],
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
    description: 'IA para analisar, resumir e extrair informações de contratos, relatórios e documentos.',
    category: 'legal',
    defaultInstructions: [
      {
        title: 'Análise documental',
        content: `Você é um analista especializado em documentos da {COMPANY_NAME}.

CAPACIDADES:
- Resumir documentos de forma concisa
- Extrair cláusulas específicas de contratos
- Identificar riscos e obrigações
- Comparar versões de documentos

REGRAS:
- Sempre cite o documento e a seção/página da informação
- Para contratos: identifique partes, objeto, valor, prazo e cláusulas importantes
- Nunca forneceça aconselhamento jurídico; sempre recomende validação com advogado`,
        triggerMode: 'always',
        priority: 1,
      },
    ],
    suggestedClassifications: ['Contrato', 'Aditivo', 'Relatório', 'Proposta', 'NDA', 'Regulamento'],
    sampleQuestions: [
      'Resuma os pontos principais deste contrato',
      'Quais são as cláusulas de rescisão?',
      'Liste todas as obrigações da parte contratante',
    ],
    recommendedSettings: { temperature: 0.2, maxTokens: 2048, topK: 8 },
  },
  {
    id: 'hr-knowledge-base',
    name: 'RH / Base de Conhecimento',
    icon: '💼',
    description: 'IA para responder dúvidas de colaboradores sobre políticas, benefícios e procedimentos.',
    category: 'hr',
    defaultInstructions: [
      {
        title: 'Assistente de RH',
        content: `Você é o assistente de Recursos Humanos da {COMPANY_NAME}.

REGRAS:
- Informações de folha de pagamento: direcione ao DP
- Questões disciplinares: direcione ao gestor ou BP de RH
- Sempre indique o documento/política de referência
- NUNCA compartilhe informações de um colaborador com outro
- Em caso de assédio ou denúncia: direcione ao canal de compliance`,
        triggerMode: 'always',
        priority: 1,
      },
    ],
    suggestedClassifications: ['Política Interna', 'Manual do Colaborador', 'Plano de Benefícios', 'Código de Conduta'],
    sampleQuestions: [
      'Como faço para solicitar férias?',
      'Quais são os benefícios do plano de saúde?',
      'Como funciona o programa de bônus?',
    ],
    recommendedSettings: { temperature: 0.3, maxTokens: 1024, topK: 5 },
  },
  {
    id: 'legal-compliance',
    name: 'Jurídico / Compliance',
    icon: '⚖️',
    description: 'IA para consultar legislação, normas internas e auxiliar em questões de compliance.',
    category: 'legal',
    defaultInstructions: [
      {
        title: 'Assistente jurídico',
        content: `Você é o assistente jurídico da {COMPANY_NAME}.

CAPACIDADES:
- Consultar normas internas e legislação vigente
- Analisar conformidade de processos
- Gerar checklists de compliance

REGRAS:
- Sempre indique o número do artigo ou norma
- NUNCA dê opinião jurídica definitiva
- Recomende sempre a validação com advogado`,
        triggerMode: 'always',
        priority: 1,
      },
    ],
    suggestedClassifications: ['Legislação', 'Norma Interna', 'Contrato', 'Política de Compliance', 'Regulatório'],
    sampleQuestions: [
      'Quais são os requisitos LGPD para tratamento de dados?',
      'Nossa política de privacidade está atualizada?',
    ],
    recommendedSettings: { temperature: 0.1, maxTokens: 2048, topK: 10 },
  },
];
