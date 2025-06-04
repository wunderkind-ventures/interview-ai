# Creates backups
timestamp=$(date +%Y%m%d%H%M%S); mkdir -p "/home/user/studio/context/context_backup/" && cp "/home/user/.idx/ai/capra-context-state.json" "/home/user/studio/context/context_backup/capra-context-state-${timestamp}.json" && cp "/home/user/.idx/ai/capra-thread.json" "/home/user/studio/context/context_backup/capra-thread-${timestamp}.json"

