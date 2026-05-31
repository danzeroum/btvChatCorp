// Garante que o crate seja recompilado quando QUALQUER migration mudar.
//
// O macro `sqlx::migrate!("../../migrations")` em main.rs embute os checksums
// das migrations em tempo de compilacao. Se um binario cacheado (CI) carrega
// checksums antigos enquanto o passo `sqlx migrate run` aplica os arquivos
// atuais, o startup entra em panic:
//   "migration N was previously applied but has been modified".
//
// `cargo:rerun-if-changed` sobre o DIRETORIO nao detecta edicao de conteudo de
// um arquivo .sql existente (so deteccao de add/remove). Por isso emitimos a
// diretiva por ARQUIVO — isso forca o recompile/re-embed quando o conteudo de
// qualquer migration muda, mantendo embedded == aplicado.
use std::path::Path;

fn main() {
    let manifest_dir =
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR sempre definido pelo cargo");
    let migrations_dir = Path::new(&manifest_dir).join("../../migrations");

    // Recompila se arquivos forem adicionados/removidos do diretorio.
    println!("cargo:rerun-if-changed={}", migrations_dir.display());

    // E recompila se o CONTEUDO de qualquer migration existente mudar.
    if let Ok(entries) = std::fs::read_dir(&migrations_dir) {
        for entry in entries.flatten() {
            println!("cargo:rerun-if-changed={}", entry.path().display());
        }
    }
}
