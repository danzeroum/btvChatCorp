use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTemplate {
    pub id: &'static str,
    pub name: &'static str,
    pub icon: &'static str,
    pub description: &'static str,
    pub category: &'static str,
    pub default_instructions: &'static str,
    pub suggested_classifications: &'static [&'static str],
    pub sample_questions: &'static [&'static str],
    pub temperature: f32,
    pub max_tokens: u32,
    pub top_k: u32,
}

pub const PROJECT_TEMPLATES: &[ProjectTemplate] = &[
    ProjectTemplate {
        id: "customer-support",
        name: "Atendimento ao Cliente",
        icon: "🎧",
        description: "IA para responder dúvidas de clientes com base em FAQ, manuais e políticas.",
        category: "customer",
        default_instructions: "Você é o assistente virtual da {COMPANY_NAME}. Responda em \
            português, de forma educada e profissional. Baseie suas respostas EXCLUSIVAMENTE \
            nos documentos fornecidos. Se não encontrar a informação, diga que não encontrou \
            e sugira o suporte. NUNCA invente informações.",
        suggested_classifications: &["FAQ", "Manual do Produto", "Política de Trocas", "SLA"],
        sample_questions: &[
            "Qual o prazo de entrega para São Paulo?",
            "Como faço para trocar um produto com defeito?",
            "Quais formas de pagamento vocês aceitam?",
        ],
        temperature: 0.3,
        max_tokens: 1024,
        top_k: 5,
    },
    ProjectTemplate {
        id: "document-analysis",
        name: "Análise de Documentos",
        icon: "📄",
        description: "IA para analisar, resumir e extrair informações de contratos e relatórios.",
        category: "legal",
        default_instructions: "Você é um analista especializado em documentos da {COMPANY_NAME}. \
            Resuma documentos, extraia cláusulas, identifique riscos e obrigações. \
            Sempre cite o documento e a seção/página. Nunca forneça aconselhamento jurídico \
            — sempre recomende validação com advogado.",
        suggested_classifications: &["Contrato", "Aditivo", "Relatório", "Proposta", "NDA"],
        sample_questions: &[
            "Resuma os pontos principais deste contrato.",
            "Quais são as cláusulas de rescisão?",
            "Identifique riscos neste contrato.",
        ],
        temperature: 0.2,
        max_tokens: 2048,
        top_k: 8,
    },
    ProjectTemplate {
        id: "hr-knowledge-base",
        name: "RH Base de Conhecimento",
        icon: "👥",
        description: "IA para responder dúvidas de colaboradores sobre políticas e benefícios.",
        category: "hr",
        default_instructions: "Você é o assistente de Recursos Humanos da {COMPANY_NAME}. \
            Responda dúvidas sobre políticas, benefícios e procedimentos. \
            Para questões disciplinares, direcione ao gestor. \
            NUNCA compartilhe informações de um colaborador com outro.",
        suggested_classifications: &[
            "Política Interna", "Manual do Colaborador", "Plano de Benefícios",
        ],
        sample_questions: &[
            "Como faço para solicitar férias?",
            "Quais são os benefícios do plano de saúde?",
            "Qual o processo para trabalhar remotamente?",
        ],
        temperature: 0.3,
        max_tokens: 1024,
        top_k: 5,
    },
    ProjectTemplate {
        id: "legal-compliance",
        name: "Jurídico & Compliance",
        icon: "⚖️",
        description: "IA para consultar legislação, normas internas e auxiliar em compliance.",
        category: "legal",
        default_instructions: "Você é o assistente jurídico da {COMPANY_NAME}. \
            SEMPRE inclua: 'Esta informação é apenas referencial. Consulte o departamento \
            jurídico para orientação formal.' Cite artigos de lei com precisão. \
            Classifique riscos como CRÍTICO / ALTO / MÉDIO / BAIXO.",
        suggested_classifications: &["Legislação", "Norma Interna", "Parecer Jurídico", "LGPD"],
        sample_questions: &[
            "Quais os requisitos da LGPD para tratamento de dados sensíveis?",
            "Gere um checklist de compliance para o novo fornecedor.",
        ],
        temperature: 0.1,
        max_tokens: 2048,
        top_k: 10,
    },
    ProjectTemplate {
        id: "tech-support",
        name: "Suporte Técnico TI",
        icon: "🖥️",
        description: "IA para auxiliar equipe de TI com troubleshooting e runbooks.",
        category: "tech",
        default_instructions: "Você é o assistente de suporte técnico da {COMPANY_NAME}. \
            Para comandos, sempre mostre em bloco de código. \
            SEMPRE alerte sobre comandos destrutivos. \
            Classifique severidade P1/P2/P3/P4.",
        suggested_classifications: &["Runbook", "Documentação Técnica", "SOP", "Post-mortem"],
        sample_questions: &[
            "O servidor de produção está com CPU em 100%, o que verificar?",
            "Como fazer rollback do deploy no Kubernetes?",
        ],
        temperature: 0.2,
        max_tokens: 2048,
        top_k: 8,
    },
];

/// Retorna o template pelo id, ou None.
pub fn find_template(id: &str) -> Option<&'static ProjectTemplate> {
    PROJECT_TEMPLATES.iter().find(|t| t.id == id)
}
