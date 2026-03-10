use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrandTheme {
    pub primary: String,
    pub secondary: String,
    pub background: String,
    pub surface: String,
    pub surface_hover: String,
    pub sidebar_bg: String,
    pub sidebar_text: String,
    pub sidebar_active_item: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub text_on_primary: String,
    pub border: String,
    pub border_focus: String,
    pub success: String,
    pub warning: String,
    pub error: String,
    pub info: String,
    pub font_family: String,
    pub font_family_mono: String,
    pub border_radius: String,
    pub border_radius_lg: String,
    pub border_radius_full: String,
    pub primary_hover: String,
    pub primary_light: String,
    pub custom_css: Option<String>,
}

impl Default for BrandTheme {
    fn default() -> Self {
        Self {
            primary: "#2563EB".into(),
            secondary: "#7C3AED".into(),
            background: "#F8FAFC".into(),
            surface: "#FFFFFF".into(),
            surface_hover: "#F1F5F9".into(),
            sidebar_bg: "#1E293B".into(),
            sidebar_text: "#CBD5E1".into(),
            sidebar_active_item: "#2563EB".into(),
            text_primary: "#0F172A".into(),
            text_secondary: "#64748B".into(),
            text_on_primary: "#FFFFFF".into(),
            border: "#E2E8F0".into(),
            border_focus: "#2563EB".into(),
            success: "#10B981".into(),
            warning: "#F59E0B".into(),
            error: "#EF4444".into(),
            info: "#3B82F6".into(),
            font_family: "'Inter', 'Segoe UI', sans-serif".into(),
            font_family_mono: "'JetBrains Mono', 'Fira Code', monospace".into(),
            border_radius: "8px".into(),
            border_radius_lg: "12px".into(),
            border_radius_full: "9999px".into(),
            primary_hover: String::new(),
            primary_light: String::new(),
            custom_css: None,
        }
    }
}

pub fn generate_theme_css(theme: &BrandTheme) -> String {
    let primary_hover = if theme.primary_hover.is_empty() {
        darken_color(&theme.primary, 10)
    } else {
        theme.primary_hover.clone()
    };
    let primary_light = if theme.primary_light.is_empty() {
        lighten_color(&theme.primary, 90)
    } else {
        theme.primary_light.clone()
    };

    format!(r#"
:root {{
    --color-primary: {primary};
    --color-primary-hover: {primary_hover};
    --color-primary-light: {primary_light};
    --color-primary-rgb: {primary_rgb};
    --color-secondary: {secondary};
    --color-background: {background};
    --color-surface: {surface};
    --color-surface-hover: {surface_hover};
    --color-sidebar-bg: {sidebar_bg};
    --color-sidebar-text: {sidebar_text};
    --color-sidebar-active: {sidebar_active};
    --color-text-primary: {text_primary};
    --color-text-secondary: {text_secondary};
    --color-text-on-primary: {text_on_primary};
    --color-border: {border};
    --color-border-focus: {border_focus};
    --color-success: {success};
    --color-warning: {warning};
    --color-error: {error};
    --color-info: {info};
    --font-family: {font_family};
    --font-family-mono: {font_mono};
    --radius: {radius};
    --radius-lg: {radius_lg};
    --radius-full: {radius_full};
}}

@media (prefers-color-scheme: dark) {{
    :root[data-theme="auto"] {{
        --color-background: #0F172A;
        --color-surface: #1E293B;
        --color-text-primary: #F1F5F9;
        --color-text-secondary: #94A3B8;
        --color-border: #334155;
    }}
}}

:root[data-theme="dark"] {{
    --color-background: #0F172A;
    --color-surface: #1E293B;
    --color-text-primary: #F1F5F9;
    --color-text-secondary: #94A3B8;
    --color-border: #334155;
}}

{custom_css}
"#,
        primary = theme.primary,
        primary_hover = primary_hover,
        primary_light = primary_light,
        primary_rgb = hex_to_rgb(&theme.primary),
        secondary = theme.secondary,
        background = theme.background,
        surface = theme.surface,
        surface_hover = theme.surface_hover,
        sidebar_bg = theme.sidebar_bg,
        sidebar_text = theme.sidebar_text,
        sidebar_active = theme.sidebar_active_item,
        text_primary = theme.text_primary,
        text_secondary = theme.text_secondary,
        text_on_primary = theme.text_on_primary,
        border = theme.border,
        border_focus = theme.border_focus,
        success = theme.success,
        warning = theme.warning,
        error = theme.error,
        info = theme.info,
        font_family = theme.font_family,
        font_mono = theme.font_family_mono,
        radius = theme.border_radius,
        radius_lg = theme.border_radius_lg,
        radius_full = theme.border_radius_full,
        custom_css = theme.custom_css.as_deref().unwrap_or(""),
    )
}

fn hex_to_rgb(hex: &str) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() == 6 {
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
        format!("{}, {}, {}", r, g, b)
    } else {
        "0, 0, 0".into()
    }
}

fn darken_color(hex: &str, percent: u8) -> String {
    adjust_color(hex, -(percent as i16))
}

fn lighten_color(hex: &str, percent: u8) -> String {
    adjust_color(hex, percent as i16)
}

fn adjust_color(hex: &str, delta: i16) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 { return format!("#{}", hex); }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    let clamp = |v: i16| v.clamp(0, 255) as u8;
    format!("#{:02X}{:02X}{:02X}",
        clamp(r as i16 + delta),
        clamp(g as i16 + delta),
        clamp(b as i16 + delta),
    )
}
