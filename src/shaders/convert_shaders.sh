#!/bin/bash

# Текущая директория (где находится скрипт)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Целевая подпапка
TARGET_DIR="$SCRIPT_DIR/shaders_text"

# Создаём подпапку если её нет
mkdir -p "$TARGET_DIR"

# Копируем все .wgsl файлы из текущей папки в shaders_text с расширением .txt
for file in "$SCRIPT_DIR"/*.wgsl; do
    if [ -f "$file" ]; then
        filename=$(basename "$file" .wgsl)
        cp "$file" "$TARGET_DIR/${filename}.txt"
        echo "Converted: $(basename "$file") -> shaders_text/${filename}.txt"
    fi
done

echo ""
echo "Done! All .wgsl files converted to .txt"
echo "Location: $TARGET_DIR"
