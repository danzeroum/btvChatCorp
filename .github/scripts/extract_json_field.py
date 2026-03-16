#!/usr/bin/env python3
"""Extrai campo de um JSON e imprime o valor.
Uso: python3 extract_json_field.py <campo> <<< '<json>'
     echo '<json>' | python3 extract_json_field.py <campo>
"""
import sys
import json

field = sys.argv[1] if len(sys.argv) > 1 else 'id'
data = json.load(sys.stdin)
print(data[field])
