CREATE TABLE chat_attachments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id        UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    workspace_id   UUID NOT NULL,
    filename       TEXT NOT NULL,
    mime_type      TEXT NOT NULL,
    size_bytes     BIGINT NOT NULL,
    extracted_text TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_attachments_chat ON chat_attachments(chat_id);
