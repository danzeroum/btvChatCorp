use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

pub struct AppError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
}

impl AppError {
    pub fn new(status: StatusCode, code: &'static str, msg: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: msg.into(),
        }
    }
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", msg)
    }
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "unauthorized", msg)
    }
    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, "forbidden", msg)
    }
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", msg)
    }
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "bad_request", msg)
    }
    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, "conflict", msg)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": { "code": self.code, "message": self.message }
        });
        (self.status, Json(body)).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        match e {
            sqlx::Error::RowNotFound => Self::not_found("Registro não encontrado"),
            _ => {
                tracing::error!("DB error: {:?}", e);
                Self::internal("Erro interno")
            }
        }
    }
}
