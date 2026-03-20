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

    let mut text = String::new();
    for child in &docx.document.body.children {
        if let docx_rs::BodyChild::Paragraph(p) = child {
            for child in &p.children {
                if let docx_rs::ParagraphChild::Run(run) = child {
                    for child in &run.children {
                        if let docx_rs::RunChild::Text(t) = child {
                            text.push_str(&t.value);
                        }
                    }
                }
            }
            text.push('\n');
        }
    }
    Ok(text.trim().to_string())
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
