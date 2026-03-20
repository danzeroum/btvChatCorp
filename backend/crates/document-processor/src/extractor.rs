use anyhow::Result;
use tracing::warn;

/// Extrai texto de um arquivo conforme seu MIME type.
pub async fn extract_text(path: &str, mime_type: &str) -> Result<String> {
    let text = match mime_type {
        "application/pdf" => extract_pdf(path)?,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => {
            extract_docx(path)?
        }
        "text/html" => extract_html(path).await?,
        _ => tokio::fs::read_to_string(path).await?,
    };
    if text.trim().is_empty() {
        anyhow::bail!("Arquivo vazio ou sem texto extra\u{ed}vel: {}", path);
    }
    Ok(text)
}

fn extract_pdf(path: &str) -> Result<String> {
    let bytes = std::fs::read(path)?;
    if let Ok(text) = pdf_extract::extract_text_from_mem(&bytes) {
        let trimmed = text.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }
    // Fallback: varre bytes em busca de texto leg\u{ed}vel (strings ASCII longas)
    warn!(
        "PDF sem texto nativo em {}, usando fallback byte-scan",
        path
    );
    let mut result = String::new();
    let mut run = String::new();
    for &b in &bytes {
        if b.is_ascii_graphic() || b == b' ' {
            run.push(b as char);
        } else {
            if run.len() > 4 {
                result.push_str(&run);
                result.push(' ');
            }
            run.clear();
        }
    }
    if result.trim().is_empty() {
        anyhow::bail!("PDF sem texto extra\u{ed}vel: {}", path);
    }
    Ok(result.trim().to_string())
}

fn extract_docx(path: &str) -> Result<String> {
    let bytes = std::fs::read(path)?;
    let docx =
        docx_rs::read_docx(&bytes).map_err(|e| anyhow::anyhow!("docx parse error: {:?}", e))?;

    // Usa a API JSON do docx-rs para navegar a \u{e1}rvore de forma vers\u{e3}o-est\u{e1}vel
    let json: serde_json::Value = serde_json::from_str(&docx.json())
        .map_err(|e| anyhow::anyhow!("docx json error: {:?}", e))?;

    let mut text = String::new();
    collect_text(&json["document"]["children"], &mut text);
    Ok(text.trim().to_string())
}

/// Percorre recursivamente os n\u{f3}s JSON do docx-rs coletando texto.
fn collect_text(node: &serde_json::Value, out: &mut String) {
    match node {
        serde_json::Value::Array(arr) => {
            for item in arr {
                collect_text(item, out);
            }
        }
        serde_json::Value::Object(map) => {
            // N\u{f3} de texto: { "type": "text", "data": { "text": "..." } }
            if map.get("type").and_then(|v| v.as_str()) == Some("text") {
                if let Some(t) = map
                    .get("data")
                    .and_then(|d| d.get("text"))
                    .and_then(|v| v.as_str())
                {
                    out.push_str(t);
                }
                return;
            }
            // Adiciona quebra de linha ap\u{f3}s par\u{e1}grafos
            let is_paragraph = map.get("type").and_then(|v| v.as_str()) == Some("paragraph");
            if let Some(children) = map.get("data").and_then(|d| d.get("children")) {
                collect_text(children, out);
            }
            if is_paragraph {
                out.push('\n');
            }
        }
        _ => {}
    }
}

async fn extract_html(path: &str) -> Result<String> {
    let raw = tokio::fs::read_to_string(path).await?;
    let re_tag = regex::Regex::new(r"<[^>]+>").unwrap();
    let re_space = regex::Regex::new(r"\s{2,}").unwrap();
    let stripped = re_tag.replace_all(&raw, " ");
    let clean = re_space.replace_all(&stripped, " ");
    let decoded = clean
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&quot;", "\"");
    Ok(decoded.trim().to_string())
}
