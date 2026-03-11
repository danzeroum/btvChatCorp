use axum::http::StatusCode;
use axum::response::{IntoResponse, Json, Response};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Erro padronizado retornado por todos os endpoints da API Pública.
/// Segue o formato OpenAI para compatibilidade com SDKs existentes.
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
    pub request_id: String,
}

impl ApiError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            error: ErrorDetail {
                code: code.into(),
                message: message.into(),
                request_id: Uuid::new_v4().to_string(),
            },
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match self.error.code.as_str() {
            "missing_api_key" | "invalid_auth_format" | "invalid_key_format" => StatusCode::UNAUTHORIZED,
            "insufficient_permissions" => StatusCode::FORBIDDEN,
            "not_found" => StatusCode::NOT_FOUND,
            "rate_limit_exceeded" => StatusCode::TOO_MANY_REQUESTS,
            "validation_error" | "missing_file" | "missing_filename" => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(self)).into_response()
    }
}

/// Helper para construir respostas de erro rapidamente nos handlers
pub fn err_response(code: &str, message: impl Into<String>) -> ApiError {
    ApiError::new(code, message)
}
