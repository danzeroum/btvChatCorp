use serde::{Deserialize, Serialize};

/// Tema visual completo de um workspace.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BrandTheme {
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_primary")]
    pub primary: String,
    #[serde(default)]
    pub primary_hover: String,
    #[serde(default)]
    pub primary_light: String,
    #[serde(default = "default_secondary")]
    pub secondary: String,
    #[serde(default = "default_background")]
    pub background: String,
    #[serde(default = "default_surface")]
    pub surface: String,
    #[serde(default = "default_surface_hover")]
    pub surface_hover: String,
    #[serde(default = "default_sidebar_bg")]
    pub sidebar_bg: String,
    #[serde(default = "default_sidebar_text")]
    pub sidebar_text: String,
    #[serde(default = "default_sidebar_active")]
    pub sidebar_active_item: String,
    #[serde(default = "default_text_primary")]
    pub text_primary: String,
    #[serde(default = "default_text_secondary")]
    pub text_secondary: String,
    #[serde(default = "default_text_on_primary")]
    pub text_on_primary: String,
    #[serde(default = "default_border")]
    pub border: String,
    #[serde(default = "default_border_focus")]
    pub border_focus: String,
    #[serde(default = "default_success")]
    pub success: String,
    #[serde(default = "default_warning")]
    pub warning: String,
    #[serde(default = "default_error")]
    pub error: String,
    #[serde(default = "default_info")]
    pub info: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_mono")]
    pub font_family_mono: String,
    #[serde(default = "default_radius")]
    pub border_radius: String,
    #[serde(default = "default_radius_lg")]
    pub border_radius_lg: String,
    #[serde(default = "default_radius_full")]
    pub border_radius_full: String,
    #[serde(default)]
    pub custom_css: String,
}

fn default_mode() -> String {
    "light".into()
}
fn default_primary() -> String {
    "2563EB".into()
}
fn default_secondary() -> String {
    "7C3AED".into()
}
fn default_background() -> String {
    "FFFFFF".into()
}
fn default_surface() -> String {
    "F8FAFC".into()
}
fn default_surface_hover() -> String {
    "F1F5F9".into()
}
fn default_sidebar_bg() -> String {
    "0F172A".into()
}
fn default_sidebar_text() -> String {
    "E2E8F0".into()
}
fn default_sidebar_active() -> String {
    "1E40AF".into()
}
fn default_text_primary() -> String {
    "0F172A".into()
}
fn default_text_secondary() -> String {
    "64748B".into()
}
fn default_text_on_primary() -> String {
    "FFFFFF".into()
}
fn default_border() -> String {
    "E2E8F0".into()
}
fn default_border_focus() -> String {
    "2563EB".into()
}
fn default_success() -> String {
    "22C55E".into()
}
fn default_warning() -> String {
    "F59E0B".into()
}
fn default_error() -> String {
    "EF4444".into()
}
fn default_info() -> String {
    "3B82F6".into()
}
fn default_font_family() -> String {
    "Inter, system-ui, sans-serif".into()
}
fn default_font_mono() -> String {
    "JetBrains Mono, monospace".into()
}
fn default_radius() -> String {
    "8px".into()
}
fn default_radius_lg() -> String {
    "12px".into()
}
fn default_radius_full() -> String {
    "9999px".into()
}

/// Gera o CSS com variáveis CSS baseado no tema do workspace.
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
    let primary_rgb = hex_to_rgb(&theme.primary);

    format!(
        r#":root {{
  /* Primary */
  --color-primary: #{primary};
  --color-primary-hover: #{primary_hover};
  --color-primary-light: #{primary_light};
  --color-primary-rgb: {primary_rgb};
  /* Secondary */
  --color-secondary: #{secondary};
  /* Surfaces */
  --color-background: #{background};
  --color-surface: #{surface};
  --color-surface-hover: #{surface_hover};
  /* Sidebar */
  --color-sidebar-bg: #{sidebar_bg};
  --color-sidebar-text: #{sidebar_text};
  --color-sidebar-active: #{sidebar_active};
  /* Text */
  --color-text-primary: #{text_primary};
  --color-text-secondary: #{text_secondary};
  --color-text-on-primary: #{text_on_primary};
  /* Borders */
  --color-border: #{border};
  --color-border-focus: #{border_focus};
  /* Status */
  --color-success: #{success};
  --color-warning: #{warning};
  --color-error: #{error};
  --color-info: #{info};
  /* Typography */
  --font-family: {font_family};
  --font-family-mono: {font_mono};
  /* Radius */
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
        primary_rgb = primary_rgb,
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
        custom_css = theme.custom_css,
    )
}

/// Converte hex para string RGB "r, g, b".
pub fn hex_to_rgb(hex: &str) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return "0, 0, 0".into();
    }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    format!("{}, {}, {}", r, g, b)
}

/// Escurece uma cor hex por uma porcentagem (0-100).
pub fn darken_color(hex: &str, percent: u8) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return "000000".into();
    }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    let factor = (100 - percent) as f32 / 100.0;
    format!(
        "{:02x}{:02x}{:02x}",
        (r as f32 * factor) as u8,
        (g as f32 * factor) as u8,
        (b as f32 * factor) as u8,
    )
}

/// Clareia uma cor hex (mistura com branco).
pub fn lighten_color(hex: &str, percent: u8) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return "FFFFFF".into();
    }
    let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    let factor = percent as f32 / 100.0;
    format!(
        "{:02x}{:02x}{:02x}",
        (r as f32 + (255.0 - r as f32) * factor) as u8,
        (g as f32 + (255.0 - g as f32) * factor) as u8,
        (b as f32 + (255.0 - b as f32) * factor) as u8,
    )
}

/// Gera CSS a partir de um serde_json::Value (usado pelas rotas HTTP).
pub fn generate_css(theme: &serde_json::Value) -> String {
    let t: BrandTheme = serde_json::from_value(theme.clone()).unwrap_or_default();
    generate_theme_css(&t)
}

#[cfg(test)]
mod css_generator_tests {
    use super::*;

    #[test]
    fn test_hex_to_rgb() {
        assert_eq!(hex_to_rgb("2563EB"), "37, 99, 235");
        assert_eq!(hex_to_rgb("#FFFFFF"), "255, 255, 255");
        assert_eq!(hex_to_rgb("000000"), "0, 0, 0");
    }

    #[test]
    fn test_darken_color() {
        assert_eq!(darken_color("FFFFFF", 10), "e5e5e5");
        assert_eq!(darken_color("000000", 50), "000000");
    }

    #[test]
    fn test_lighten_color() {
        assert_eq!(lighten_color("000000", 100), "ffffff");
        assert_eq!(lighten_color("FFFFFF", 0), "ffffff");
    }

    #[test]
    fn test_generate_theme_css_contains_variables() {
        let theme = BrandTheme {
            primary: "2563EB".into(),
            secondary: "7C3AED".into(),
            ..BrandTheme::default()
        };
        let css = generate_theme_css(&theme);
        assert!(css.contains("--color-primary: #2563EB"));
        assert!(css.contains("--color-secondary: #7C3AED"));
        assert!(css.contains(":root"));
    }

    #[test]
    fn test_generate_theme_css_custom_css_appended() {
        let theme = BrandTheme {
            custom_css: ".sidebar { outline: 1px solid red; }".into(),
            ..BrandTheme::default()
        };
        let css = generate_theme_css(&theme);
        assert!(css.contains(".sidebar { outline: 1px solid red; }"));
    }
}
