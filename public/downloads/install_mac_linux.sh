#!/bin/bash
# КиберБот — Установка (Mac / Linux)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║    КиберБот — Установка (Mac/Linux)      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Проверка Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден!"
    echo ""
    echo "Mac: brew install python3"
    echo "Ubuntu/Debian: sudo apt install python3 python3-pip"
    exit 1
fi

echo "✅ Python3 найден: $(python3 --version)"
echo ""
echo "📦 Устанавливаю зависимости..."
pip3 install requests schedule --quiet

echo "✅ Зависимости установлены"
echo ""

# Определяем директорию скрипта
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "⚙️  Настройка автозапуска..."

# Mac — LaunchAgent
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLIST_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$PLIST_DIR"

    cat > "$PLIST_DIR/dev.kiberbot.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>dev.kiberbot</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which python3)</string>
        <string>${SCRIPT_DIR}/kiberbot.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${SCRIPT_DIR}/kiberbot.log</string>
    <key>StandardErrorPath</key>
    <string>${SCRIPT_DIR}/kiberbot_error.log</string>
</dict>
</plist>
EOF

    launchctl load "$PLIST_DIR/dev.kiberbot.plist" 2>/dev/null
    echo "✅ Mac автозапуск настроен (LaunchAgent)"

# Linux — systemd
elif command -v systemctl &> /dev/null; then
    cat > /tmp/kiberbot.service << EOF
[Unit]
Description=КиберБот Автономный планировщик
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=${SCRIPT_DIR}
ExecStart=$(which python3) ${SCRIPT_DIR}/kiberbot.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

    sudo mv /tmp/kiberbot.service /etc/systemd/system/kiberbot.service
    sudo systemctl daemon-reload
    sudo systemctl enable kiberbot
    sudo systemctl start kiberbot
    echo "✅ Linux systemd сервис установлен и запущен"
    echo "   Статус: sudo systemctl status kiberbot"

# Crontab (запасной вариант)
else
    CRON_CMD="@reboot python3 ${SCRIPT_DIR}/kiberbot.py >> ${SCRIPT_DIR}/kiberbot.log 2>&1"
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "✅ Автозапуск через crontab настроен"
fi

echo ""
echo "══════════════════════════════════════════"
echo "🚀 Запускаю КиберБот..."
echo "══════════════════════════════════════════"
echo ""

python3 "$SCRIPT_DIR/kiberbot.py"
