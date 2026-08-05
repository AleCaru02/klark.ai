#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR=${1:-}
TARGET_DIR=${2:-.}

if [[ -z "$SOURCE_DIR" || ! -d "$SOURCE_DIR" ]]; then
  echo "Uso: $0 <cartella-sorgente-lovable> [cartella-target]" >&2
  exit 2
fi

mkdir -p "$TARGET_DIR"

# Importa il codebase senza copiare segreti, metadati Git o dipendenze generate.
rsync -a --delete-delay \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.vercel/' \
  --exclude='.lovable/' \
  --exclude='supabase/migrations/20260805*.sql' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

# Mantiene le migrazioni di hardening applicate e i documenti di audit già presenti.
echo "Import completato. Verificare git diff, installare dipendenze ed eseguire lint/typecheck/test/build prima del commit."
