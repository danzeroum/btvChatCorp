use anyhow::{bail, Result};
use tracing::warn;

/// Extrai texto puro de um arquivo dado seu caminho e mime_type.
pub async fn extract_text(path: &str, mime_type: &str) -> Result<String> {
    match mime_type {
        "application/pdf" => extract_pdf(path),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        | "application/msword" => extract_docx(path),
        "text/html" | "application/xhtml+xml" => extract_html(path).await,
        // txt, csv, md, json, xml — leitura direta
        _ => extract_plain(path).await,
    }
}

// ── PDF ─────────────────────────────────────────────────────────────────────

fn extract_pdf(path: &str) -> Result<String> {
    let bytes = std::fs::read(path)?;
    match pdf_extract::extract_text_from_mem(&bytes) {
        Ok(text) => Ok(text),
        Err(e) => {
            warn!("pdf-extract falhou ({}), tentando fallback byte-scan", e);
            // Fallback: extrai strings legíveis do binário PDF
            Ok(extract_printable_strings(&bytes))
        }
    }
}

fn extract_printable_strings(data: &[u8]) -> String {
    let mut out = String::new();
    let mut buf = String::new();
    for &b in data {
        if b.is_ascii_graphic() || b == b' ' {
            buf.push(b as char);
        } else {
            if buf.len() > 4 {
                out.push_str(&buf);
                out.push(' ');
            }
            buf.clear();
        }
    }
    out
}

// ── DOCX ────────────────────────────────────────────────────────────────────

fn extract_docx(path: &str) -> Result<String> {
    let bytes = std::fs::read(path)?;
    let docx = docx_rs::read_docx(&bytes)
        .map_err(|e| anyhow::anyhow!("docx parse error: {:?}", e))?;

    let mut text = String::new();
    for child in &docx.document.body.children {
        use docx_rs::BodyChild;
        if let BodyChild::Paragraph(para) = child {
            for run_child in &para.children {
                use docx_rs::ParagraphChild;
                if let ParagraphChild::Run(run) = run_child {
                    for rc in &run.children {
                        use docx_rs::RunChild;
                        if let RunChild::Text(t) = rc {
                            text.push_str(&t.text);
                        }
                    }
                }
            }
            text.push('\n');
        }
    }
    Ok(text)
}

// ── HTML ────────────────────────────────────────────────────────────────────

async fn extract_html(path: &str) -> Result<String> {
    let raw = tokio::fs::read_to_string(path).await?;
    // Remove tags HTML com regex simples
    let re_tag   = regex::Regex::new(r"<[^>]+>").unwrap();
    let re_space = regex::Regex::new(r"\s{2,}").unwrap();
    let stripped = re_tag.replace_all(&raw, " ");
    let clean    = re_space.replace_all(&stripped, " ");
    // Decodifica entidades HTML básicas
    let decoded = clean
        .replace("&amp;",  "&")
        .replace("&lt;",   "<")
        .replace("&gt;",   ">")
        .replace("&nbsp;", " ")
        .replace("&quot;", "\"");
    Ok(decoded.trim().to_string())
}

// ── Plain text / CSV / MD ───────────────────────────────────────────────────

async fn extract_plain(path: &str) -> Result<String> {
    let text = tokio::fs::read_to_string(path).await?;
    if text.is_empty() {
        bail!("Arquivo vazio");
    }
    Ok(text)
}
