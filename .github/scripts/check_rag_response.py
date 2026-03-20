#!/usr/bin/env python3
"""Valida resposta do endpoint de chat RAG.
Uso: python3 check_rag_response.py <json_file> [--check-sources-null]
"""
import sys
import json

if len(sys.argv) < 2:
    print("Uso: check_rag_response.py <json_file> [--check-sources-null]")
    sys.exit(1)

with open(sys.argv[1]) as f:
    m = json.load(f)

check_sources = '--check-sources-null' in sys.argv

if check_sources:
    sources = m.get('sources')
    if sources is not None:
        print(f'ERRO: sources deveria ser null, got: {sources}')
        sys.exit(1)
    print('sources=null OK (sem documentos indexados)')
else:
    role = m.get('role', '')
    content = m.get('content', '')
    if role != 'assistant':
        print(f'ERRO: role errado: {role}')
        sys.exit(1)
    if len(content) == 0:
        print('ERRO: conteudo vazio')
        sys.exit(1)
    print(f'Chat RAG degradation OK (role={role}, content_len={len(content)})')
