use crate::searcher::RagResult;

/// Contexto do workspace injetado no system prompt
#[derive(Debug, Clone)]
pub struct WorkspaceContext {
    pub company_name: String,
    pub sector: String,
    pub preferred_tone: Option<String>,
    pub language: Option<String>,
    pub custom_system_prompt: Option<String>,
}

/// Mensagem de conversa (formato OpenAI)
#[derive(Debug, Clone)]
pub struct ConversationMessage {
    pub role: String, // "system", "user", "assistant"
    pub content: String,
}

/// Mensagem formatada para o LLM
#[derive(Debug, Clone)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

/// Constrói o prompt final para o LLM combinando:
/// 1. System prompt customizado do workspace
/// 2. Contexto RAG formatado
/// 3. Histórico da conversa (últimas N mensagens)
/// 4. Pergunta do usuário
pub struct PromptBuilder {
    pub max_history_tokens: usize,
    pub max_history_messages: usize,
    pub context_truncate_chars: usize,
}

impl Default for PromptBuilder {
    fn default() -> Self {
        Self {
            max_history_tokens: 2000,
            max_history_messages: 10,
            context_truncate_chars: 200,
        }
    }
}

impl PromptBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Monta a lista de mensagens para enviar ao LLM
    pub fn build(
        &self,
        user_query: &str,
        rag_results: &RagResult,
        conversation_history: &[ConversationMessage],
        workspace_ctx: &WorkspaceContext,
    ) -> Vec<LlmMessage> {
        let mut messages: Vec<LlmMessage> = Vec::new();

        // ── 1. System prompt do workspace ────────────────────────────────────────
        let context = self.format_rag_context(rag_results);
        let custom_instructions = workspace_ctx
            .custom_system_prompt
            .as_deref()
            .unwrap_or("");

        let system_content = format!(
            r#"Você é um assistente especializado para a empresa {company}.
Setor: {sector}.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com base nos documentos fornecidos abaixo.
- Se a informação não estiver nos documentos, diga explicitamente: "Não encontrei essa informação na base de conhecimento."
- NUNCA invente informações ou cite fontes que não foram fornecidas.
- Cite a fonte (nome do documento e seção) ao final de cada afirmação importante.
- Mantenha o tom {tone}.
- Idioma: {language}.
{custom}

DOCUMENTOS DE REFERÊNCIA:
{context}"#,
            company = workspace_ctx.company_name,
            sector = workspace_ctx.sector,
            tone = workspace_ctx
                .preferred_tone
                .as_deref()
                .unwrap_or("profissional e objetivo"),
            language = workspace_ctx
                .language
                .as_deref()
                .unwrap_or("Português brasileiro"),
            custom = if custom_instructions.is_empty() {
                String::new()
            } else {
                format!("\n{}", custom_instructions)
            },
            context = context,
        );

        messages.push(LlmMessage {
            role: "system".into(),
            content: system_content,
        });

        // ── 2. Histórico da conversa (últimas N mensagens, respeitando limite) ───
        let mut history_tokens = 0usize;
        let recent: Vec<&ConversationMessage> = conversation_history
            .iter()
            .rev()
            .take(self.max_history_messages)
            .collect();

        // Insere na ordem correta (do mais antigo ao mais recente)
        for msg in recent.into_iter().rev() {
            let msg_tokens = estimate_tokens(&msg.content);
            if history_tokens + msg_tokens > self.max_history_tokens {
                break;
            }
            // Insere após o system message
            let insert_pos = 1;
            messages.insert(
                insert_pos,
                LlmMessage {
                    role: msg.role.clone(),
                    content: msg.content.clone(),
                },
            );
            history_tokens += msg_tokens;
        }

        // ── 3. Pergunta do usuário ───────────────────────────────────────────────
        messages.push(LlmMessage {
            role: "user".into(),
            content: user_query.to_string(),
        });

        messages
    }

    /// Formata os chunks RAG em texto estruturado para o contexto do prompt
    pub fn format_rag_context(&self, rag: &RagResult) -> String {
        let mut context = String::new();

        for (i, chunk) in rag.chunks.iter().enumerate() {
            context.push_str(&format!("--- Documento {} ---\n", i + 1));

            if let Some(title) = &chunk.section_title {
                context.push_str(&format!("Seção: {}\n", title));
            }
            context.push_str(&format!("Tipo: {}\n", chunk.chunk_type));

            // Contexto expandido: chunk anterior
            if let Some(before) = &chunk.context_before {
                context.push_str(&format!(
                    "[Contexto anterior]: {}\n",
                    self.truncate(before, self.context_truncate_chars)
                ));
            }

            // Chunk principal
            context.push_str(&chunk.content);
            context.push('\n');

            // Contexto expandido: chunk posterior
            if let Some(after) = &chunk.context_after {
                context.push_str(&format!(
                    "[Contexto posterior]: {}\n",
                    self.truncate(after, self.context_truncate_chars)
                ));
            }

            context.push_str("---\n");
        }
        context
    }

    fn truncate(&self, text: &str, max_chars: usize) -> String {
        if text.len() <= max_chars {
            text.to_string()
        } else {
            format!("{}…", &text[..max_chars])
        }
    }
}

/// Estimativa simples de tokens (word-based)
fn estimate_tokens(text: &str) -> usize {
    (text.split_whitespace().count() as f64 / 0.75).ceil() as usize
}
