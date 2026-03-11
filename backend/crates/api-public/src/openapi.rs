use axum::Router;

/// Retorna o Router com a Swagger UI embutida.
/// A spec OpenAPI é gerada automaticamente via `utoipa`.
/// TODO: decorar os handlers com macros `#[utoipa::path(...)]` e
///       registrá-los no struct `ApiDoc` abaixo.
pub fn swagger_ui() -> Router {
    // Placeholder — integração real com utoipa-swagger-ui:
    //
    // use utoipa::OpenApi;
    // use utoipa_swagger_ui::SwaggerUi;
    //
    // #[derive(OpenApi)]
    // #[openapi(paths(...), components(schemas(...)), tags(...)]
    // struct ApiDoc;
    //
    // SwaggerUi::new("/api-docs")
    //     .url("/api/openapi.json", ApiDoc::openapi())
    //
    // Por ora retorna router vazio para não bloquear compilação
    Router::new()
}
