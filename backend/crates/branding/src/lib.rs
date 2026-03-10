pub mod css_generator;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceBranding {
    pub workspace_id: Uuid,
    pub display_name: String,
    pub logo_url: Option<String>,
    pub favicon_url: Option<String>,
    pub custom_domain: Option<String>,
    pub theme: css_generator::BrandTheme,
    pub assistant_name: String,
    pub welcome_message: String,
}

impl WorkspaceBranding {
    pub fn generate_css(&self) -> String {
        css_generator::generate_theme_css(&self.theme)
    }
}
