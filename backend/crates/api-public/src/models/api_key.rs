use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Contexto injetado nas extensions após autenticação por API Key
#[derive(Debug, Clone)]
pub struct ApiKeyContext {
    pub key_id: String,
    pub workspace_id: Uuid,
    pub key_name: String,
    pub permissions: Vec<ApiKeyPermission>,
    pub project_scope: ProjectScope,
    pub rate_limit: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyPermission {
    pub resource: String,
    pub actions: Vec<String>,
}

impl ApiKeyPermission {
    pub fn allows(&self, resource: &str, action: &str) -> bool {
        self.resource == resource && self.actions.iter().any(|a| a == action)
    }
}

#[derive(Debug, Clone)]
pub enum ProjectScope {
    All,
    Specific(Vec<String>),
}

/// Verifica se o contexto tem permissão para resource + action
pub fn require_permission(
    ctx: &ApiKeyContext,
    resource: &str,
    action: &str,
) -> Result<(), crate::errors::ApiError> {
    let has = ctx.permissions.iter().any(|p| p.allows(resource, action));
    if !has {
        return Err(crate::errors::ApiError::new(
            "insufficient_permissions",
            format!(
                "API key '{}' does not have permission to {} on {}",
                ctx.key_name, action, resource
            ),
        ));
    }
    Ok(())
}
