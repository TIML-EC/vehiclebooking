document.addEventListener('DOMContentLoaded', () => {
    const cardStatus = document.getElementById('card-status');
    const nameSelect = document.getElementById('name-select');
    const customName = document.getElementById('custom-name');
    const writeButton = document.getElementById('write-button');
    const cardInfo = document.getElementById('card-info');
    const connectButton = document.getElementById('connect-button');

    let port;
    let writer;
    let reader;
    const decoder = new TextDecoder();
    let buffer = '';

    connectButton.addEventListener('click', async () => {
        if ('serial' in navigator) {
            try {
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });

                writer = port.writable.getWriter();
                reader = port.readable.getReader();

                connectButton.textContent = '已連接';
                connectButton.disabled = true;
                cardStatus.textContent = '等待 IC 咭';

                readLoop();
            } catch (err) {
                console.error('連接序列埠時發生錯誤:', err);
                alert('無法連接到 Arduino。請確保它已插入，並且您已選擇正確的序列埠。');
            }
        } else {
            alert('您的瀏覽器不支援 Web Serial API。請使用最新版本的 Chrome、Edge 或 Opera 瀏覽器。');
        }
    });

    writeButton.addEventListener('click', async () => {
        if (!writer) {
            alert('請先連接到 Arduino。');
            return;
        }

        const name = customName.value || nameSelect.value;
        if (!name) {
            alert('請選擇或輸入一個名稱。');
            return;
        }

        const command = `WRITE:${name}\n`;
        await writer.write(new TextEncoder().encode(command));
        cardStatus.textContent = '寫入中...';
    });

    async function readLoop() {
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    reader.releaseLock();
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 保留不完整的行

                lines.forEach(line => handleMessage(line.trim()));
            }
        } catch (error) {
            console.error('讀取資料時發生錯誤:', error);
            writer?.releaseLock();
            reader?.releaseLock();
            port?.close();
            connectButton.textContent = '連接 Arduino';
            connectButton.disabled = false;
        }
    }

    function handleMessage(line) {
        if (!line) return;

        console.log(`接收到: ${line}`);
        const [key, ...values] = line.split(':');
        const value = values.join(':').trim();

        switch (key) {
            case 'STATUS':
                cardStatus.textContent = value;
                if (value === 'Card Found' || value === 'Write successful') {
                    cardInfo.textContent = ''; // 清空以準備接收新資訊
                }
                break;
            case 'UID':
                cardInfo.textContent += `IC 咭 UID: ${value}\n`;
                break;
            case 'TYPE':
                cardInfo.textContent += `咭類型: ${value}\n`;
                break;
            case 'NAME':
                cardInfo.textContent += `目前名稱: ${value}\n`;
                break;
            case 'INFO':
                cardInfo.textContent += `${value}\n`;
                break;
            default:
                console.warn(`未知的訊息金鑰: ${key}`);
        }
    }
});