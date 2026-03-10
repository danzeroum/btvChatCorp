export interface ProjectTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  defaultInstruction: string;
  suggestedClassifications: string[];
  sampleQuestions: string[];
  recommendedSettings: { temperature: number; maxTokens: number; topK: number };
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'customer-support',
    name: 'Atendimento ao Cliente',
    icon: '\uD83D\uDCDE',
    description: 'IA para responder d\xFAvidas com base em FAQ, manuais e pol\xEDticas.',
    category: 'customer',
    defaultInstruction: `Voc\xEA \xE9 o assistente virtual da COMPANY_NAME.\nRESPONDA apenas com base nos documentos fornecidos.\nSe n\xE3o encontrar a informa\xE7\xE3o, diga: \'N\xE3o encontrei na nossa base. Contate: SUPPORT_EMAIL.\'\nNUNCA invente informa\xE7\xF5es ou pre\xE7os.`,
    suggestedClassifications: ['FAQ', 'Manual do Produto', 'Pol\xEDtica de Trocas', 'Tabela de Pre\xE7os', 'SLA'],
    sampleQuestions: [
      'Qual o prazo de entrega para S\xE3o Paulo?',
      'Como fa\xE7o para trocar um produto com defeito?',
      'Quais formas de pagamento voc\xEAs aceitam?',
    ],
    recommendedSettings: { temperature: 0.3, maxTokens: 1024, topK: 5 },
  },
  {
    id: 'document-analysis',
    name: 'An\xE1lise de Documentos',
    icon: '\uD83D\uDCCB',
    description: 'IA para analisar, resumir e extrair informa\xE7\xF5es de contratos e relat\xF3rios.',
    category: 'legal',
    defaultInstruction: `Voc\xEA \xE9 um analista especializado em documentos da COMPANY_NAME.\nSempre cite o documento e a se\xE7\xE3o/p\xE1gina da informa\xE7\xE3o.\nPara contratos, identifique: partes, objeto, valor, prazo e cl\xE1usulas importantes.\nClassifique riscos como ALTO, M\xC9DIO, BAIXO com justificativa.\nNUNCA forne\xE7a aconselhamento jur\xEDdico — recomende valida\xE7\xE3o com advogado.`,
    suggestedClassifications: ['Contrato', 'Aditivo', 'Relat\xF3rio', 'Proposta', 'NDA'],
    sampleQuestions: [
      'Resuma os pontos principais deste contrato',
      'Quais s\xE3o as cl\xE1usulas de rescis\xE3o?',
      'Identifique riscos neste contrato',
    ],
    recommendedSettings: { temperature: 0.2, maxTokens: 2048, topK: 8 },
  },
  {
    id: 'hr-knowledge-base',
    name: 'RH Base de Conhecimento',
    icon: '\uD83D\uDC65',
    description: 'IA para responder d\xFAvidas de colaboradores sobre pol\xEDticas e benef\xEDcios.',
    category: 'hr',
    defaultInstruction: `Voc\xEA \xE9 o assistente de RH da COMPANY_NAME.\nResponda d\xFAvidas sobre pol\xEDticas internas, benef\xEDcios e procedimentos.\nMANTENHA confidencialidade — nunca compartilhe dados de um colaborador com outro.\nPara quest\xF5es de ass\xE9dio ou den\xFAncia, direcione ao canal de compliance.`,
    suggestedClassifications: ['Pol\xEDtica Interna', 'Manual do Colaborador', 'Plano de Benef\xEDcios', 'C\xF3digo de Conduta'],
    sampleQuestions: [
      'Como fa\xE7o para solicitar f\xE9rias?',
      'Quais s\xE3o os benef\xEDcios do plano de sa\xFAde?',
      'Como funciona o programa de b\xF4nus?',
    ],
    recommendedSettings: { temperature: 0.3, maxTokens: 1024, topK: 5 },
  },
  {
    id: 'legal-compliance',
    name: 'Jur\xEDdico & Compliance',
    icon: '\u2696\uFE0F',
    description: 'IA para consultar legisla\xE7\xE3o, normas internas e auxiliar em compliance.',
    category: 'legal',
    defaultInstruction: `Voc\xEA \xE9 o assistente jur\xEDdico da COMPANY_NAME.\nSEMPRE inclua o disclaimer: \'Esta informa\xE7\xE3o \xE9 apenas referencial. Consulte o departamento jur\xEDdico.\'\nCite artigos de lei, normas e documentos internos com precis\xE3o.\nClassifique riscos como CR\xCDTICO, ALTO, M\xC9DIO, BAIXO.`,
    suggestedClassifications: ['Legisla\xE7\xE3o', 'Norma Interna', 'Parecer Jur\xEDdico', 'LGPD', 'Regulamento Setorial'],
    sampleQuestions: [
      'Quais os requisitos da LGPD para tratamento de dados sens\xEDveis?',
      'Gere um checklist de compliance para o novo fornecedor',
    ],
    recommendedSettings: { temperature: 0.1, maxTokens: 2048, topK: 10 },
  },
  {
    id: 'tech-support',
    name: 'Suporte T\xE9cnico / TI',
    icon: '\uD83D\uDCBB',
    description: 'IA para troubleshooting, runbooks e documenta\xE7\xE3o t\xE9cnica.',
    category: 'tech',
    defaultInstruction: `Voc\xEA \xE9 o assistente de suporte t\xE9cnico da COMPANY_NAME.\nPara comandos, sempre exiba o comando completo em bloco de c\xF3digo.\nClassifique incidentes: CR\xCDTICO, ALTO, M\xC9DIO, BAIXO.\nSe o problema n\xE3o estiver documentado, diga claramente.`,
    suggestedClassifications: ['Runbook', 'Documenta\xE7\xE3o T\xE9cnica', 'KB', 'SLA de Suporte'],
    sampleQuestions: [
      'Como reiniciar o servi\xE7o X?',
      'Qual o procedimento para rollback do deploy?',
      'Liste os alertas cr\xEDticos do monitoramento',
    ],
    recommendedSettings: { temperature: 0.2, maxTokens: 1024, topK: 6 },
  },
];
