#!/usr/bin/env bash
cd "$(dirname "$0")"

# Use local node if system node is not in PATH
if ! command -v node &> /dev/null; then
  export PATH="$(pwd)/.tools/bin:$PATH"
fi

echo "🚀 Starte PDF Tool ForAll..."
echo "📱 Für iPad: Öffne einfach die angezeigte 'Network' URL in Safari auf deinem iPad (im selben WLAN)!"
echo ""

npm run dev -- --host
