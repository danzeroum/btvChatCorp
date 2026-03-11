use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::OrchestratorError;

// ─── Structs de entrada ───────────────────────────────────────────────────────

#[derive(Debug)]
pub struct CreateInteraction {
    pub workspace_id: Uuid,
    pub user_message: String,
    pub rag_context: Option<serde_json::Value>,
    pub data_classification: Option<String>,
    pub pii_detected: bool,
    pub eligible_for_training: bool,
    pub model_version: String,
    pub project_id: Option<Uuid>,
}

#[derive(Debug)]
pub struct Feedback {
    pub rating: Option<String>,         // "positive" | "negative"
    pub correction: Option<String>,     // texto corrigido pelo usuário
    pub categories: Option<String>,     // "factual_error,incomplete"
    pub user_id: Uuid,
}

// ─── Registro retornado pelo DB ───────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TrainingInteraction {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub user_message: String,
    pub assistant_response: Option<String>,
    pub rag_context: Option<serde_json::Value>,
    pub data_classification: Option<String>,
    pub pii_detected: bool,
    pub eligible_for_training: bool,
    pub user_rating: Option<String>,
    pub user_correction: Option<String>,
    pub feedback_categories: Option<String>,
    pub curator_status: String,
    pub model_version: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ─── Repositório ──────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct TrainingRepo {
    pool: PgPool,
}

impl TrainingRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Cria um registro de interação (sem resposta ainda — será atualizado ao final do stream)
    pub async fn create_interaction(
        &self,
        data: CreateInteraction,
    ) -> Result<Uuid, OrchestratorError> {
        let id = Uuid::new_v4();

        sqlx::query!(
            r#"
            INSERT INTO training_interactions (
                id, workspace_id, user_message, rag_context,
                data_classification, pii_detected, eligible_for_training,
                model_version, project_id, curator_status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
            "#,
            id,
            data.workspace_id,
            data.user_message,
            data.rag_context,
            data.data_classification,
            data.pii_detected,
            data.eligible_for_training,
            data.model_version,
            data.project_id,
        )
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    /// Atualiza a resposta completa após o stream terminar
    pub async fn update_response(
        &self,
        interaction_id: Uuid,
        response: String,
        prompt_tokens: u32,
        completion_tokens: u32,
    ) -> Result<(), OrchestratorError> {
        sqlx::query!(
            r#"
            UPDATE training_interactions
            SET assistant_response = $1,
                prompt_tokens = $2,
                completion_tokens = $3
            WHERE id = $4
            "#,
            response,
            prompt_tokens as i32,
            completion_tokens as i32,
            interaction_id,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Salva feedback do usuário (thumbs up/down + correção)
    pub async fn add_feedback(
        &self,
        interaction_id: Uuid,
        feedback: Feedback,
    ) -> Result<(), OrchestratorError> {
        sqlx::query!(
            r#"
            UPDATE training_interactions
            SET user_rating      = $1,
                user_correction  = $2,
                feedback_categories = $3
            WHERE id = $4
            "#,
            feedback.rating,
            feedback.correction,
            feedback.categories,
            interaction_id,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Marca interação como alta prioridade de curadoria (tem correção manual)
    pub async fn flag_high_priority(
        &self,
        interaction_id: Uuid,
    ) -> Result<(), OrchestratorError> {
        sqlx::query!(
            r#"
            UPDATE training_interactions
            SET curator_priority = 'high'
            WHERE id = $1
            "#,
            interaction_id,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Lista interações pendentes de curadoria para o painel admin
    pub async fn list_pending_review(
        &self,
        workspace_id: Uuid,
        limit: i64,
    ) -> Result<Vec<TrainingInteraction>, OrchestratorError> {
        let rows = sqlx::query_as!(
            TrainingInteraction,
            r#"
            SELECT id, workspace_id, user_message, assistant_response, rag_context,
                   data_classification, pii_detected, eligible_for_training,
                   user_rating, user_correction, feedback_categories,
                   curator_status, model_version, created_at
            FROM training_interactions
            WHERE workspace_id = $1
              AND curator_status = 'pending'
              AND eligible_for_training = true
            ORDER BY
                CASE WHEN curator_priority = 'high' THEN 0 ELSE 1 END,
                created_at DESC
            LIMIT $2
            "#,
            workspace_id,
            limit,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Aprova ou rejeita um item de curadoria
    pub async fn curate(
        &self,
        interaction_id: Uuid,
        curator_id: Uuid,
        status: &str,   // "approved" | "rejected"
        notes: Option<&str>,
        final_answer: Option<&str>,
    ) -> Result<(), OrchestratorError> {
        sqlx::query!(
            r#"
            UPDATE training_interactions
            SET curator_status   = $1,
                curator_id       = $2,
                curator_notes    = $3,
                curated_at       = NOW(),
                -- Se curador editou a resposta, usa ela como correção final
                user_correction  = COALESCE($4, user_correction)
            WHERE id = $5
            "#,
            status,
            curator_id,
            notes,
            final_answer,
            interaction_id,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
