# Sprint 2 — Grupo C: Testes

## Issues
- #28 T4: Teste E2E Playwright — fluxo crítico completo
- #29 Novo: Testes unitários mínimos dos 4 crates Rust

## Dependências
Este grupo depende dos Grupos A e B estarem concluídos:
- Docker-compose funcional (#27)
- Frontend sem duplicatas (#21, #22, #23)
- Backend compilando (#25, #26)

## Fluxo E2E a validar
1. Registro e login de usuário
2. Criação de workspace
3. Upload de documento PDF
4. Consulta ao chat com verificação de fontes RAG
5. Envio de feedback (thumbs up/down)
6. Verificação de que o feedback aparece no pipeline de treinamento

## Critério de aceitação
- `npm run test:e2e` passa sem falhas
- `cargo test --workspace` passa
- Cobertura ≥ 30% por crate (medida com `cargo tarpaulin`)
