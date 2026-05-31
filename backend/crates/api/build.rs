// Garante que o crate seja recompilado quando QUALQUER migration mudar.
//
// O macro `sqlx::migrate!("../../migrations")` em main.rs embute as migrations
// (e seus checksums) em tempo de compilacao. Sem este build script, o cargo nao
// sabe que os arquivos .sql fazem parte das entradas de compilacao do crate —
// entao um `target/` cacheado em CI serve um binario com checksums antigos,
// enquanto o passo `sqlx migrate run` aplica os arquivos atuais. O resultado e
// o panic "migration N was previously applied but has been modified" no startup.
//
// Declarar rerun-if-changed forca o recompile (e re-embute os checksums atuais)
// sempre que uma migration for adicionada ou alterada.
fn main() {
    println!("cargo:rerun-if-changed=../../migrations");
}
