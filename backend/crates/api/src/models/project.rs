use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Project {
    pub id:               Uuid,
    pub workspace_id:     Uuid,
    pub name:             String,
    pub description:      Option<String>,
    pub icon:             Option<String>,
    pub color:            Option<String>,
    pub status:           String,
    pub category:         Option<String>,
    pub priority:         String,
    pub tags:             Vec<String>,
    pub created_by:       Uuid,
    pub last_activity_at: Option<DateTime<Utc>>,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectDto {
    pub name:        String,
    pub description: Option<String>,
    pub icon:        Option<String>,
    pub color:       Option<String>,
    pub category:    Option<String>,
    pub priority:    Option<String>,
    pub tags:        Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectDto {
    pub name:        Option<String>,
    pub description: Option<String>,
    pub icon:        Option<String>,
    pub color:       Option<String>,
    pub status:      Option<String>,
    pub category:    Option<String>,
    pub priority:    Option<String>,
    pub tags:        Option<Vec<String>>,
}
