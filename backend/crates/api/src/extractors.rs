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
    /// roles "owner" e "admin" recebem `workspace:manage`; demais recebem vazio.
    pub fn from_role(user_id: Uuid, workspace_id: Uuid, role: &str) -> Self {
        let permissions = if role == "admin" || role == "owner" {
            vec![Permission {
                resource: "workspace".to_string(),
                actions: vec!["manage".to_string()],
            }]
        } else {
            vec![]
        };
        Self {
            user_id,
            workspace_id,
            permissions,
        }
    }
}

#[cfg(test)]
mod extractors_tests {
    use super::*;
    use uuid::Uuid;

    fn has_manage(ctx: &WorkspaceContext) -> bool {
        ctx.permissions
            .iter()
            .any(|p| p.resource == "workspace" && p.actions.contains(&"manage".to_string()))
    }

    #[test]
    fn owner_recebe_workspace_manage() {
        let ctx = WorkspaceContext::from_role(Uuid::new_v4(), Uuid::new_v4(), "owner");
        assert!(has_manage(&ctx), "owner deve ter workspace:manage");
    }

    #[test]
    fn admin_recebe_workspace_manage() {
        let ctx = WorkspaceContext::from_role(Uuid::new_v4(), Uuid::new_v4(), "admin");
        assert!(has_manage(&ctx), "admin deve ter workspace:manage");
    }

    #[test]
    fn member_nao_recebe_workspace_manage() {
        let ctx = WorkspaceContext::from_role(Uuid::new_v4(), Uuid::new_v4(), "member");
        assert!(!has_manage(&ctx), "member nao deve ter workspace:manage");
    }

    #[test]
    fn viewer_nao_recebe_workspace_manage() {
        let ctx = WorkspaceContext::from_role(Uuid::new_v4(), Uuid::new_v4(), "viewer");
        assert!(!has_manage(&ctx));
    }
}
