use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::chat::{Chat, CreateChatDto, FeedbackDto, Message, SendMessageDto},
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/chats", get(list).post(create))
        .route("/chats/:id", get(get_one).delete(remove))
        .route("/chats/:id/messages", get(get_messages).post(send_message))
        .route("/chats/:id/messages/:mid/feedback", post(feedback))
}

async fn list(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Chat>>, AppError> {
    let rows = sqlx::query_as::<_, Chat>(
        "SELECT id,workspace_id,project_id,title,summary,is_pinned,created_by,created_at,updated_at
         FROM chats WHERE workspace_id=$1 AND created_by=$2 ORDER BY updated_at DESC",
    )
    .bind(auth.workspace_id)
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

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
    Ok((StatusCode::CREATED, Json(row)))
}

async fn get_one(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Chat>, AppError> {
    let row = sqlx::query_as::<_, Chat>(
        "SELECT * FROM chats WHERE id=$1 AND workspace_id=$2",
    )
    .bind(id)
    .bind(auth.workspace_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

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

async fn send_message(
    Extension(auth): Extension<AuthUser>,
    State(state): State<AppState>,
    Path(chat_id): Path<Uuid>,
    Json(dto): Json<SendMessageDto>,
) -> Result<Json<Message>, AppError> {
    sqlx::query("SELECT id FROM chats WHERE id=$1 AND workspace_id=$2")
        .bind(chat_id)
        .bind(auth.workspace_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| AppError::not_found("Chat nao encontrado"))?;

    // Salva mensagem do usuario
    sqlx::query_as::<_, Message>(
        "INSERT INTO messages (chat_id,role,content) VALUES ($1,'user',$2) RETURNING *",
    )
    .bind(chat_id)
    .bind(&dto.content)
    .fetch_one(&state.db)
    .await?;

    // Busca historico para contexto
    let history: Vec<(String, String)> = sqlx::query_as(
        "SELECT role, content FROM messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 20",
    )
    .bind(chat_id)
    .fetch_all(&state.db)
    .await?;

    let messages: Vec<serde_json::Value> = history
        .into_iter()
        .rev()
        .map(|(role, content)| serde_json::json!({ "role": role, "content": content }))
        .collect();

    // Chama LLM ou usa mock em ambiente de teste (OLLAMA_MOCK=true)
    let llm_resp = if std::env::var("OLLAMA_MOCK").as_deref() == Ok("true") {
        LlmResponse {
            content: format!("[mock] Resposta para: {}", dto.content),
            tokens_used: Some(42),
        }
    } else {
        call_llm(
            &state.ollama_url,
            &state.ollama_model,
            state.ollama_auth.as_deref(),
            &messages,
            dto.temperature.unwrap_or(0.7),
            dto.max_tokens.unwrap_or(1024),
        )
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
    };

    let assistant_msg = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (chat_id,role,content,tokens_used) VALUES ($1,'assistant',$2,$3) RETURNING *",
    )
    .bind(chat_id)
    .bind(&llm_resp.content)
    .bind(llm_resp.tokens_used)
    .fetch_one(&state.db)
    .await?;

    sqlx::query("UPDATE chats SET updated_at=NOW() WHERE id=$1")
        .bind(chat_id)
        .execute(&state.db)
        .await
        .ok();

    Ok(Json(assistant_msg))
}

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

struct LlmResponse {
    content: String,
    tokens_used: Option<i32>,
}

/// Chama LLM compativel com OpenAI /v1/chat/completions
/// Suporta Ollama local E LLMs externas com Basic Auth
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
            "model": model,
            "messages": messages,
            "stream": false,
            "temperature": temperature,
            "max_tokens": max_tokens,
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
        tokens_used: resp["usage"]["completion_tokens"].as_i64().map(|t| t as i32),
    })
}
