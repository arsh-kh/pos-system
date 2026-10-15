const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // In production, we load the built React app. In dev, we load the local Vite server.
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handler for Receipt Printing using ESC/POS protocol
ipcMain.on('print-receipt', (event, receiptData) => {
  console.log('Printing Receipt via ESC/POS...', receiptData);
  
  // Implementation of ESC/POS formatting
  const ESC = "\x1B";
  const GS = "\x1D";
  
  let receiptText = "";
  receiptText += ESC + "@"; // Initialize printer
  receiptText += ESC + "a" + "1"; // Align center
  receiptText += "POS SYSTEM\n";
  receiptText += "------------------------\n";
  receiptText += ESC + "a" + "0"; // Align left
  
  receiptData.items.forEach(item => {
    receiptText += `${item.name} x${item.quantity}  ${item.total} IQD\n`;
  });
  
  receiptText += "------------------------\n";
  receiptText += `TOTAL: ${receiptData.total} IQD\n`;
  receiptText += "\n\n\n\n"; // Feed paper
  receiptText += GS + "V" + "A" + "\x00"; // Cut paper

  // For real hardware:
  // const client = new net.Socket();
  // client.connect(9100, '192.168.1.100', () => {
  //   client.write(Buffer.from(receiptText));
  //   client.destroy();
  // });

  console.log(receiptText);
  event.reply('print-receipt-reply', { success: true });
});
