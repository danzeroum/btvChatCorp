from sentence_transformers import SentenceTransformer, CrossEncoder

print("Baixando modelo de embedding...")
SentenceTransformer("nomic-ai/nomic-embed-text-v1.5")

print("Baixando modelo de reranking...")
CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

print("Modelos pre-carregados com sucesso.")
