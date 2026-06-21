use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{
        sse::{Event, Sse},
        IntoResponse,
    },
    routing::{delete, get, patch, post},
    Extension, Json, Router,
};
use futures::{channel::mpsc, StreamExt};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::chat::{Chat, CreateChatDto, FeedbackDto, Message, SendMessageDto},
    rag::{build_rag_context, build_sources_json, search_rag},
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/chats", get(list).post(create))
        .route("/chats/:id", get(get_one).delete(remove).patch(rename))
        .route("/chats/:id/messages", get(get_messages).post(send_message))
        .route("/chats/:id/messages/:mid", delete(delete_message))
        .route("/chats/:id/messages/:mid/feedback", post(feedback))
        .route("/chats/:id/project", patch(transfer_to_project))
        .route("/chat/stream", post(stream_message))
        .route("/health/ollama", get(ollama_health))
}

/// Versão estendida de Chat com o nome do projeto para uso na listagem.
#[derive(serde::Serialize, sqlx::FromRow)]
struct ChatListItem {
    id: Uuid,
    workspace_id: Uuid,
    project_id: Option<Uuid>,
    title: String,
    summary: Option<String>,
    is_pinned: Option<bool>,
    created_by: Option<Uuid>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
    project_name: Option<String>,
}

#[derive(serde::Deserialize)]
struct ChatListQuery {
    q: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/chats",
    tag = "Chat",
    security(("BearerAuth" = [])),
    responses(
        (status = 200, description = "Lista de chats com nome do projeto"),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn list(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Query(query): Query<ChatListQuery>,
) -> Result<Json<Vec<ChatListItem>>, AppError> {
    // Busca opcional (?q=): casa por título OU por conteúdo de mensagem.
    let like = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s));

    let rows = sqlx::query_as::<_, ChatListItem>(
        "SELECT c.id, c.workspace_id, c.project_id, c.title, c.summary,
                c.is_pinned, c.created_by, c.created_at, c.updated_at,
                p.name AS project_name
         FROM chats c
         LEFT JOIN projects p ON p.id = c.project_id
         WHERE c.workspace_id=$1 AND c.created_by=$2
           AND ($3::text IS NULL
                OR c.title ILIKE $3
                OR EXISTS (SELECT 1 FROM messages m
                           WHERE m.chat_id=c.id AND m.content ILIKE $3))
         ORDER BY c.is_pinned DESC, c.updated_at DESC",
    )
    .bind(auth.workspace_id)
    .bind(auth.user_id)
    .bind(&like)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/chats",
    tag = "Chat",
    security(("BearerAuth" = [])),
    request_body = CreateChatDto,
    responses(
        (status = 201, description = "Chat criado", body = Chat),
        (status = 401, description = "Nao autenticado"),
    )
)]
async fn create(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(dto): Json<CreateChatDto>,
) -> Result<(StatusCode, Json<Chat>), AppError> {
    let title = dto.title.unwrap_or_else(|| "Nova conversa".into());
    let row = sqlx::query_as::<_, Chat>(
        "INSERT INTO chats (workspace_id,project_id,title,created_by) VALUES ($1,$2,$3,$4) RETURNING *",
    )
    .bind(auth.workspace_id)
    .bind(dto.project_id)
    .bind(&title)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;
    state
        .webhooks
        .dispatch(webhooks::WebhookEvent {
            event_type: webhooks::WebhookEventType::ChatCreated,
            workspace_id: auth.workspace_id.to_string(),
            data: serde_json::json!({ "chat_id": row.id, "project_id": row.project_id }),
            meta: None,
        })
        .await;
    Ok((StatusCode::CREATED, Json(row)))
}

#[utoipa::path(
    get,
    path = "/api/v1/chats/{id}",
    tag = "Chat",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do chat")),
    responses(
        (status = 200, description = "Chat encontrado", body = Chat),
        (status = 404, description = "Chat nao encontrado"),
    )
)]
async fn get_one(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Chat>, AppError> {
    let row = sqlx::query_as::<_, Chat>("SELECT * FROM chats WHERE id=$1 AND workspace_id=$2")
        .bind(id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/chats/{id}",
    tag = "Chat",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do chat")),
    responses(
        (status = 204, description = "Removido"),
        (status = 404, description = "Chat nao encontrado"),
    )
)]
async fn remove(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let r = sqlx::query("DELETE FROM chats WHERE id=$1 AND workspace_id=$2")
        .bind(id)
        .bind(auth.workspace_id)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;
    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Chat nao encontrado"));
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/chats/{id}/messages",
    tag = "Chat",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do chat")),
    responses(
        (status = 200, description = "Mensagens", body = Vec<Message>),
        (status = 404, description = "Chat nao encontrado"),
    )
)]
async fn get_messages(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(chat_id): Path<Uuid>,
) -> Result<Json<Vec<Message>>, AppError> {
    sqlx::query("SELECT id FROM chats WHERE id=$1 AND workspace_id=$2")
        .bind(chat_id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::not_found("Chat nao encontrado"))?;

    let rows = sqlx::query_as::<_, Message>(
        "SELECT id,chat_id,role,content,sources,tokens_used,feedback,created_at \
         FROM messages WHERE chat_id=$1 ORDER BY created_at",
    )
    .bind(chat_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/api/v1/chats/{id}/messages",
    tag = "Chat",
    security(("BearerAuth" = [])),
    params(("id" = Uuid, Path, description = "ID do chat")),
    request_body = SendMessageDto,
    responses(
        (status = 200, description = "Resposta do assistente", body = Message),
        (status = 404, description = "Chat nao encontrado"),
    )
)]
async fn send_message(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(chat_id): Path<Uuid>,
    Json(dto): Json<SendMessageDto>,
) -> Result<Json<Message>, AppError> {
    let (project_id,): (Option<Uuid>,) = sqlx::query_as(
        "SELECT project_id FROM chats WHERE id=$1 AND workspace_id=$2",
    )
    .bind(chat_id)
    .bind(auth.workspace_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::not_found("Chat nao encontrado"))?;

    sqlx::query_as::<_, Message>(
        "INSERT INTO messages (chat_id,role,content) VALUES ($1,'user',$2) RETURNING *",
    )
    .bind(chat_id)
    .bind(&dto.content)
    .fetch_one(&state.db)
    .await?;

    let rag_chunks = search_rag(
        &state.qdrant_url,
        &state.embedding_url,
        &auth.workspace_id.to_string(),
        &dto.content,
        5,
        0.35,
    )
    .await
    .unwrap_or_default();

    let rag_context = build_rag_context(&rag_chunks);
    let sources_json = build_sources_json(&rag_chunks);

    let instructions_suffix =
        build_instructions_suffix(&state.db, project_id).await;
    let attachment_suffix =
        build_attachment_context(&state.db, chat_id).await;

    let history: Vec<(String, String)> = sqlx::query_as(
        "SELECT role, content FROM messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 20",
    )
    .bind(chat_id)
    .fetch_all(&state.db)
    .await?;

    let system_content = if let Some(ctx) = rag_context {
        format!(
            "Você é um assistente especializado da empresa. \
             Responda sempre em português, seja preciso e conciso. \
             Quando usar informações do contexto, cite a fonte entre parênteses.\n\n\
             {}{}{}",
            ctx, instructions_suffix, attachment_suffix
        )
    } else {
        format!(
            "Você é um assistente especializado da empresa. \
             Responda sempre em português, seja preciso e conciso. \
             Se não souber a resposta, diga que não tem essa informação disponível.{}{}",
            instructions_suffix, attachment_suffix
        )
    };

    let mut messages: Vec<serde_json::Value> =
        vec![serde_json::json!({ "role": "system", "content": system_content })];
    messages.extend(
        history
            .into_iter()
            .rev()
            .map(|(role, content)| serde_json::json!({ "role": role, "content": content })),
    );

    let effective_model = dto.model.as_deref().unwrap_or(&state.ollama_model);

    let llm_resp = if std::env::var("OLLAMA_MOCK").as_deref() == Ok("true") {
        let mock_info = if rag_chunks.is_empty() {
            "[sem contexto RAG]".to_string()
        } else {
            format!(
                "[{} chunks RAG de: {}]",
                rag_chunks.len(),
                rag_chunks
                    .iter()
                    .map(|c| c.filename.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        };
        LlmResponse {
            content: format!("[mock] {} — Resposta para: {}", mock_info, dto.content),
            tokens_used: Some(42),
        }
    } else {
        call_llm(
            &state.ollama_url,
            effective_model,
            state.ollama_auth.as_deref(),
            &messages,
            dto.temperature.unwrap_or(0.7),
            dto.max_tokens.unwrap_or(1024),
        )
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
    };

    let assistant_msg = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (chat_id, role, content, sources, tokens_used)
         VALUES ($1, 'assistant', $2, $3, $4)
         RETURNING *",
    )
    .bind(chat_id)
    .bind(&llm_resp.content)
    .bind(&sources_json)
    .bind(llm_resp.tokens_used)
    .fetch_one(&state.db)
    .await?;

    sqlx::query("UPDATE chats SET updated_at=NOW() WHERE id=$1")
        .bind(chat_id)
        .execute(&state.db)
        .await
        .ok();

    // Gera título automático na 1ª troca (fire-and-forget, não bloqueia a resposta).
    tokio::spawn(maybe_generate_title(
        state.db.clone(),
        state.ollama_url.clone(),
        effective_model.to_string(),
        state.ollama_auth.clone(),
        chat_id,
        dto.content.clone(),
    ));

    state
        .webhooks
        .dispatch(webhooks::WebhookEvent {
            event_type: webhooks::WebhookEventType::ChatCompleted,
            workspace_id: auth.workspace_id.to_string(),
            data: serde_json::json!({ "chat_id": chat_id, "message_id": assistant_msg.id }),
            meta: None,
        })
        .await;

    Ok(Json(assistant_msg))
}

#[utoipa::path(
    post,
    path = "/api/v1/chats/{id}/messages/{mid}/feedback",
    tag = "Chat",
    security(("BearerAuth" = [])),
    params(
        ("id" = Uuid, Path, description = "ID do chat"),
        ("mid" = Uuid, Path, description = "ID da mensagem"),
    ),
    request_body = FeedbackDto,
    responses(
        (status = 200, description = "Feedback registrado"),
        (status = 400, description = "feedback deve ser 1 ou -1"),
    )
)]
async fn feedback(
    _auth: Extension<AuthUser>,
    State(state): State<AppState>,
    Path((_cid, mid)): Path<(Uuid, Uuid)>,
    Json(dto): Json<FeedbackDto>,
) -> Result<StatusCode, AppError> {
    if dto.feedback != 1 && dto.feedback != -1 {
        return Err(AppError::bad_request("feedback deve ser 1 ou -1"));
    }
    sqlx::query("UPDATE messages SET feedback=$1 WHERE id=$2")
        .bind(dto.feedback)
        .bind(mid)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;
    Ok(StatusCode::OK)
}

// -- Delete message

async fn delete_message(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path((chat_id, mid)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    sqlx::query("SELECT id FROM chats WHERE id=$1 AND workspace_id=$2")
        .bind(chat_id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::not_found("Chat nao encontrado"))?;
    let r = sqlx::query("DELETE FROM messages WHERE id=$1 AND chat_id=$2")
        .bind(mid)
        .bind(chat_id)
        .execute(&state.db)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Mensagem nao encontrada"));
    }
    Ok(StatusCode::NO_CONTENT)
}

// -- Streaming endpoint

#[derive(Debug, serde::Deserialize)]
struct ChatStreamRequest {
    message: String,
    chat_id: Option<Uuid>,
    project_id: Option<Uuid>,
    model: Option<String>,
    // Campos opcionais aceitos pelo frontend; reservados para uso futuro
    #[serde(default)]
    #[allow(dead_code)]
    classification: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    eligible_for_training: Option<bool>,
}

async fn stream_message(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Json(dto): Json<ChatStreamRequest>,
) -> impl IntoResponse {
    // 1. Resolve ou cria o chat_id
    let chat_id = if let Some(id) = dto.chat_id {
        let exists = sqlx::query("SELECT id FROM chats WHERE id=$1 AND workspace_id=$2")
            .bind(id)
            .bind(auth.workspace_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);
        if exists.is_none() {
            let _ = sqlx::query(
                "INSERT INTO chats (id, workspace_id, project_id, title, created_by)
                 VALUES ($1, $2, $3, 'Nova conversa', $4)
                 ON CONFLICT (id) DO NOTHING",
            )
            .bind(id)
            .bind(auth.workspace_id)
            .bind(dto.project_id)
            .bind(auth.user_id)
            .execute(&state.db)
            .await;
        }
        id
    } else {
        sqlx::query_as::<_, Chat>(
            "INSERT INTO chats (workspace_id, project_id, title, created_by)
             VALUES ($1, $2, 'Nova conversa', $3) RETURNING *",
        )
        .bind(auth.workspace_id)
        .bind(dto.project_id)
        .bind(auth.user_id)
        .fetch_one(&state.db)
        .await
        .map(|c| c.id)
        .unwrap_or_else(|_| Uuid::new_v4())
    };

    // 2. Salva mensagem do usuário
    let _ = sqlx::query("INSERT INTO messages (chat_id, role, content) VALUES ($1, 'user', $2)")
        .bind(chat_id)
        .bind(&dto.message)
        .execute(&state.db)
        .await;

    // Fetch project_id from chat for instruction injection
    let stream_project_id: Option<Uuid> = sqlx::query_as::<_, (Option<Uuid>,)>(
        "SELECT project_id FROM chats WHERE id=$1",
    )
    .bind(chat_id)
    .fetch_one(&state.db)
    .await
    .ok()
    .and_then(|(pid,)| pid);

    // 3. RAG
    let rag_chunks = search_rag(
        &state.qdrant_url,
        &state.embedding_url,
        &auth.workspace_id.to_string(),
        &dto.message,
        5,
        0.35,
    )
    .await
    .unwrap_or_default();
    let rag_context = build_rag_context(&rag_chunks);
    let sources_json = build_sources_json(&rag_chunks);

    let stream_instructions_suffix =
        build_instructions_suffix(&state.db, stream_project_id).await;
    let stream_attachment_suffix =
        build_attachment_context(&state.db, chat_id).await;

    // 4. Histórico (últimas 20 mensagens)
    let history: Vec<(String, String)> = sqlx::query_as(
        "SELECT role, content FROM messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 20",
    )
    .bind(chat_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let system_content = if let Some(ctx) = rag_context {
        format!(
            "Você é um assistente especializado da empresa. \
             Responda sempre em português, seja preciso e conciso. \
             Quando usar informações do contexto, cite a fonte entre parênteses.\n\n\
             {}{}{}",
            ctx, stream_instructions_suffix, stream_attachment_suffix
        )
    } else {
        format!(
            "Você é um assistente especializado da empresa. \
             Responda sempre em português, seja preciso e conciso. \
             Se não souber a resposta, diga que não tem essa informação disponível.{}{}",
            stream_instructions_suffix, stream_attachment_suffix
        )
    };

    let mut messages: Vec<serde_json::Value> =
        vec![serde_json::json!({ "role": "system", "content": system_content })];
    messages.extend(
        history
            .into_iter()
            .rev()
            .map(|(role, content)| serde_json::json!({ "role": role, "content": content })),
    );

    // 5. Canal SSE — usa futures::channel::mpsc (já dependência do workspace)
    let (tx, rx) = mpsc::unbounded::<Result<Event, std::convert::Infallible>>();

    let ollama_url = state.ollama_url.clone();
    let model = dto.model.clone().unwrap_or_else(|| state.ollama_model.clone());
    let auth_cfg = state.ollama_auth.clone();
    let db = state.db.clone();
    let src = sources_json.clone();

    // Clones dedicados para a geração de título (o ramo real consome auth_cfg/model).
    let title_url = ollama_url.clone();
    let title_model = model.clone();
    let title_auth = state.ollama_auth.clone();
    let title_msg = dto.message.clone();

    tokio::spawn(async move {
        // Mock para CI (OLLAMA_MOCK=true)
        if std::env::var("OLLAMA_MOCK").as_deref() == Ok("true") {
            let tokens = ["[mock] ", "Resposta ", "de ", "streaming ", "OK"];
            let mut full = String::new();
            for t in &tokens {
                full.push_str(t);
                let _ = tx.unbounded_send(Ok(Event::default()
                    .data(serde_json::json!({ "content": t }).to_string())));
                tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
            }
            let _ = sqlx::query(
                "INSERT INTO messages (chat_id, role, content, sources) VALUES ($1, 'assistant', $2, $3)",
            )
            .bind(chat_id)
            .bind(&full)
            .bind(&src)
            .execute(&db)
            .await;
            let _ = sqlx::query("UPDATE chats SET updated_at=NOW() WHERE id=$1")
                .bind(chat_id)
                .execute(&db)
                .await;
            let _ = tx.unbounded_send(Ok(Event::default()
                .data(serde_json::json!({ "type": "sources", "data": src }).to_string())));
            let _ = tx.unbounded_send(Ok(Event::default().data("[DONE]")));
            // Título automático após o [DONE] (não atrasa o stream).
            maybe_generate_title(
                db.clone(), title_url, title_model, title_auth, chat_id, title_msg,
            )
            .await;
            return;
        }

        // Chamada real ao Ollama com stream=true
        let client = reqwest::Client::new();
        let mut req = client
            .post(format!("{}/v1/chat/completions", ollama_url))
            .json(&serde_json::json!({
                "model":    model,
                "messages": messages,
                "stream":   true,
            }));
        if let Some(auth) = auth_cfg {
            let mut parts = auth.splitn(2, ':');
            req = req.basic_auth(
                parts.next().unwrap_or(""),
                Some(parts.next().unwrap_or("")),
            );
        }
        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let _ = tx.unbounded_send(Ok(Event::default()
                    .data(serde_json::json!({ "type": "error", "data": e.to_string() }).to_string())));
                return;
            }
        };
        let mut stream = resp.bytes_stream();
        let mut full_content = String::new();
        while let Some(Ok(chunk)) = stream.next().await {
            for line in chunk.split(|&b| b == b'\n') {
                let line = String::from_utf8_lossy(line);
                let line = line.trim();
                if !line.starts_with("data: ") {
                    continue;
                }
                let raw = line.trim_start_matches("data: ").trim();
                if raw == "[DONE]" {
                    break;
                }
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) {
                    if let Some(token) = v["choices"][0]["delta"]["content"].as_str() {
                        if token.is_empty() {
                            continue;
                        }
                        full_content.push_str(token);
                        let _ = tx.unbounded_send(Ok(Event::default()
                            .data(serde_json::json!({ "content": token }).to_string())));
                    }
                }
            }
        }
        let _ = sqlx::query(
            "INSERT INTO messages (chat_id, role, content, sources) VALUES ($1, 'assistant', $2, $3)",
        )
        .bind(chat_id)
        .bind(&full_content)
        .bind(&src)
        .execute(&db)
        .await;
        let _ = sqlx::query("UPDATE chats SET updated_at=NOW() WHERE id=$1")
            .bind(chat_id)
            .execute(&db)
            .await;
        let _ = tx.unbounded_send(Ok(Event::default()
            .data(serde_json::json!({ "type": "sources", "data": src }).to_string())));
        let _ = tx.unbounded_send(Ok(Event::default().data("[DONE]")));
        // Título automático após o [DONE] (não atrasa o stream).
        maybe_generate_title(db, title_url, title_model, title_auth, chat_id, title_msg).await;
    });

    Sse::new(rx)
}

// -- Helpers

async fn build_attachment_context(db: &sqlx::PgPool, chat_id: Uuid) -> String {
    let rows: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT filename, extracted_text FROM chat_attachments WHERE chat_id=$1 ORDER BY created_at",
    )
    .bind(chat_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let sections: Vec<String> = rows
        .into_iter()
        .filter_map(|(name, text)| {
            text.filter(|t| !t.is_empty())
                .map(|t| format!("### {}\n{}", name, t))
        })
        .collect();

    if sections.is_empty() {
        return String::new();
    }
    format!("\n\n## Arquivos anexados\n{}", sections.join("\n\n"))
}

async fn build_instructions_suffix(db: &sqlx::PgPool, project_id: Option<Uuid>) -> String {
    let Some(pid) = project_id else {
        return String::new();
    };
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT name, content FROM project_instructions
         WHERE project_id=$1 AND is_active=true AND trigger_mode='always'
         ORDER BY created_at",
    )
    .bind(pid)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        return String::new();
    }
    let lines = rows
        .iter()
        .map(|(n, c)| format!("- **{}**: {}", n, c))
        .collect::<Vec<_>>()
        .join("\n");
    format!("\n\n## Instruções do projeto\n{}", lines)
}

// -- Update chat (rename e/ou pin)

/// Atualização parcial de um chat. Os campos são independentes: enviar apenas
/// `title` renomeia sem tocar no pin, e enviar apenas `is_pinned` (des)fixa sem
/// alterar o título.
#[derive(serde::Deserialize)]
struct UpdateChatDto {
    title: Option<String>,
    is_pinned: Option<bool>,
}

async fn rename(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(dto): Json<UpdateChatDto>,
) -> Result<Json<Chat>, AppError> {
    if dto.title.is_none() && dto.is_pinned.is_none() {
        return Err(AppError::bad_request("Nada para atualizar"));
    }
    let title = match &dto.title {
        Some(t) if t.trim().is_empty() => {
            return Err(AppError::bad_request("Título não pode ser vazio"));
        }
        Some(t) => Some(t.trim().to_string()),
        None => None,
    };
    let row = sqlx::query_as::<_, Chat>(
        "UPDATE chats
            SET title = COALESCE($1, title),
                is_pinned = COALESCE($2, is_pinned),
                updated_at = NOW()
          WHERE id=$3 AND workspace_id=$4
          RETURNING *",
    )
    .bind(title)
    .bind(dto.is_pinned)
    .bind(id)
    .bind(auth.workspace_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::not_found("Chat nao encontrado"))?;
    Ok(Json(row))
}

// -- Transfer chat to another project

#[derive(Debug, serde::Deserialize)]
struct TransferChatDto {
    project_id: Option<Uuid>,
}

async fn transfer_to_project(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(chat_id): Path<Uuid>,
    Json(dto): Json<TransferChatDto>,
) -> Result<StatusCode, AppError> {
    let r = sqlx::query(
        "UPDATE chats SET project_id=$1, updated_at=NOW() WHERE id=$2 AND workspace_id=$3",
    )
    .bind(dto.project_id)
    .bind(chat_id)
    .bind(auth.workspace_id)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;
    if r.rows_affected() == 0 {
        return Err(AppError::not_found("Chat nao encontrado"));
    }
    Ok(StatusCode::OK)
}

// -- Health do Ollama (acessível a qualquer usuário autenticado)

async fn ollama_health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let online = if std::env::var("OLLAMA_MOCK").as_deref() == Ok("true") {
        true
    } else {
        let client = reqwest::Client::new();
        let mut req = client
            .get(format!("{}/v1/models", state.ollama_url))
            .timeout(std::time::Duration::from_secs(3));
        if let Some(auth) = state.ollama_auth.as_deref() {
            let mut parts = auth.splitn(2, ':');
            req = req.basic_auth(parts.next().unwrap_or(""), Some(parts.next().unwrap_or("")));
        }
        req.send().await.map(|r| r.status().is_success()).unwrap_or(false)
    };
    Json(serde_json::json!({
        "status": if online { "online" } else { "offline" },
        "url": state.ollama_url,
    }))
}

// -- Título automático

/// Gera um título curto via LLM após a 1ª troca, sem bloquear a requisição.
/// Só sobrescreve o título padrão 'Nova conversa' (não mexe em títulos manuais).
async fn maybe_generate_title(
    db: sqlx::PgPool,
    ollama_url: String,
    model: String,
    auth: Option<String>,
    chat_id: Uuid,
    user_message: String,
) {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages WHERE chat_id=$1")
        .bind(chat_id)
        .fetch_one(&db)
        .await
        .unwrap_or(99);
    if count > 2 {
        return; // não é a primeira troca
    }

    let title: Option<String> = if std::env::var("OLLAMA_MOCK").as_deref() == Ok("true") {
        // Em modo mock (CI), deriva um título simples da mensagem do usuário.
        Some(user_message.chars().take(40).collect::<String>())
    } else {
        let prompt = format!(
            "Resuma em até 6 palavras o tema desta conversa, sem pontuação e sem aspas:\nUsuário: {}",
            user_message
        );
        call_llm(
            &ollama_url,
            &model,
            auth.as_deref(),
            &[serde_json::json!({ "role": "user", "content": prompt })],
            0.3,
            20,
        )
        .await
        .ok()
        .map(|r| r.content.trim().trim_matches('"').trim().to_string())
        .filter(|t| !t.is_empty())
    };

    if let Some(title) = title {
        let _ = sqlx::query("UPDATE chats SET title=$1 WHERE id=$2 AND title='Nova conversa'")
            .bind(title)
            .bind(chat_id)
            .execute(&db)
            .await;
    }
}

// -- LLM client

struct LlmResponse {
    content: String,
    tokens_used: Option<i32>,
}

async fn call_llm(
    base_url: &str,
    model: &str,
    basic_auth: Option<&str>,
    messages: &[serde_json::Value],
    temperature: f32,
    max_tokens: u32,
) -> anyhow::Result<LlmResponse> {
    let client = reqwest::Client::new();
    let mut req = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&serde_json::json!({
            "model":       model,
            "messages":    messages,
            "stream":      false,
            "temperature": temperature,
            "max_tokens":  max_tokens,
        }));
    if let Some(auth) = basic_auth {
        let mut parts = auth.splitn(2, ':');
        let user = parts.next().unwrap_or("");
        let pass = parts.next().unwrap_or("");
        req = req.basic_auth(user, Some(pass));
    }
    let resp = req.send().await?.json::<serde_json::Value>().await?;
    Ok(LlmResponse {
        content: resp["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        tokens_used: resp["usage"]["completion_tokens"]
            .as_i64()
            .map(|t| t as i32),
    })
}
