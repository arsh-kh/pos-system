const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
  if (receiptData.isSplit) {
    receiptText += `CASH PAID: ${receiptData.paidAmount} IQD\n`;
    receiptText += `DEBT: ${receiptData.debtAmount} IQD\n`;
    receiptText += `CUSTOMER: ${receiptData.customerName}\n`;
  } else if (receiptData.isDebt) {
    receiptText += `PAYMENT: CREDIT (${receiptData.customerName})\n`;
  }
  receiptText += "\n\n\n\n"; // Feed paper
  receiptText += GS + "V" + "A" + "\x00"; // Cut paper

  console.log(receiptText);
  event.reply('print-receipt-reply', { success: true });
});

// IPC Handler: Open Backups Folder in Windows Explorer
ipcMain.handle('open-backups-folder', async () => {
  try {
    const backupsDir = path.resolve(__dirname, 'backend', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    await shell.openPath(backupsDir);
    return { success: true, path: backupsDir };
  } catch (err) {
    console.error('Failed to open backups folder:', err);
    return { success: false, error: err.message };
  }
});

// IPC Handler: Save Backup with Native Windows Save Dialog
ipcMain.handle('save-backup-dialog', async (event, { defaultFileName, content }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'پاشەکەوتکردنی فایلی باکئەپ لە کۆمپیوتەر یان فلاش (USB)',
      defaultPath: defaultFileName,
      filters: [{ name: 'JSON Backup (*.json)', extensions: ['json'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
      return { success: true, filePath };
    }
    return { canceled: true };
  } catch (err) {
    console.error('Failed to save backup via dialog:', err);
    return { success: false, error: err.message };
  }
});

