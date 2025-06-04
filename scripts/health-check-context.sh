#!/bin/bash

echo "🧠 Gemini Context Health Check"
echo "-----------------------------"
echo ""

echo "📦 Largest files (by size):"
du -sh .[!.]* * 2>/dev/null | sort -hr | head -n 10
echo ""

echo "⚠️  Files over 100KB (potential token bloat):"
find . -type f -size +100k | grep -vE "node_modules|.git|.next|dist|context_backup|internal" | sort
echo ""

echo "📏 Estimating total word count (excluding node_modules)..."
wc_output=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.md" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.next/*" \
  -not -path "*/dist/*" \
  -not -path "*/internal/*" \
  -not -path "*/context_backup/*" \
  -exec cat {} + | wc -w)
token_estimate=$(( $wc_output * 4 ))
echo "→ Total words: $wc_output (~$token_estimate tokens)"
if [ "$token_estimate" -gt 1000000 ]; then
  echo "❌ OVER TOKEN LIMIT — Gemini will fail to load context."
else
  echo "✅ Under token limit."
fi
echo ""

echo "🔍 Checking .studioignore..."
if [ -f .studioignore ]; then
  echo "✅ .studioignore found."
  for path in node_modules .next dist internal context_backup firebase-debug.log .git package-lock.json; do
    if grep -q "$path" .studioignore; then
      echo "✅ $path is ignored"
    else
      echo "⚠️  $path is NOT ignored — consider adding it"
    fi
  done
else
  echo "❌ .studioignore not found — create one!"
fi

echo ""
echo "🎯 Context Health Check Complete"