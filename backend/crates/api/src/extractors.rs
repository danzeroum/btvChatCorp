use uuid::Uuid;

/// Permissão granular derivada do role do usuário.
#[derive(Clone, Debug)]
pub struct Permission {
    pub resource: String,
    pub actions: Vec<String>,
}

/// Contexto do workspace injetado nas extensions do request pelo `require_auth`.
/// Usado pelos middlewares `admin_guard` e `audit_logger`.
#[derive(Clone, Debug)]
pub struct WorkspaceContext {
    pub user_id: Uuid,
    pub workspace_id: Uuid,
    pub permissions: Vec<Permission>,
}

impl WorkspaceContext {
    /// Deriva permissões a partir do role JWT.
    /// role "admin" recebe `workspace:manage`; demais roles recebem vazio.
    pub fn from_role(user_id: Uuid, workspace_id: Uuid, role: &str) -> Self {
        let permissions = if role == "admin" {
            vec![Permission {
                resource: "workspace".to_string(),
                actions: vec!["manage".to_string()],
            }]
        } else {
            vec![]
        };
        Self { user_id, workspace_id, permissions }
    }
}
