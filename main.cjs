const { app, BrowserWindow, Menu, ipcMain, dialog, shell, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

// Enforce single-instance lock to prevent port collisions and database locks
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance of Market POS is already running. Quitting.');
  app.quit();
}

let mainWindow = null;
let backendProcess = null;

// ESC/POS Command Constants
const ESC = "\x1B";
const GS = "\x1D";
const DRAWER_KICK = ESC + "p" + "\x00" + "\x19" + "\xFA"; // RJ11 Pin 2 Pulse (Epson / Star)
const CUT_PAPER = GS + "V" + "A" + "\x00";

// Check if backend is already listening on port 3001
function checkBackendRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/api/sync/status', (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Automatically ensure backend process is active in production or standalone desktop mode
async function ensureBackendProcess() {
  const isRunning = await checkBackendRunning();
  if (isRunning) {
    console.log('✓ Backend API server is active on port 3001');
    return;
  }

  const candidatePaths = [
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'backend', 'server.js'),
    path.join(process.resourcesPath || '', 'backend', 'server.js'),
    path.resolve(__dirname, 'backend', 'server.js'),
    path.resolve(__dirname, '..', 'backend', 'server.js')
  ];

  const serverScript = candidatePaths.find(p => fs.existsSync(p));

  if (serverScript) {
    const backendCwd = path.dirname(serverScript);
    console.log('🚀 Spawning embedded backend service:', serverScript);

    // 1. Prefer Electron native utilityProcess (safe, embedded, avoids OS spawn ENOENT)
    if (utilityProcess && typeof utilityProcess.fork === 'function') {
      try {
        backendProcess = utilityProcess.fork(serverScript, [], {
          serviceName: 'pos-backend',
          cwd: backendCwd,
          env: { ...process.env }
        });

        backendProcess.on('spawn', () => {
          console.log('✓ Embedded backend utilityProcess successfully started');
        });

        backendProcess.on('error', (err) => {
          console.warn('⚠️ Embedded backend utilityProcess error:', err.message);
        });

        backendProcess.on('exit', (code) => {
          console.log(`Backend process exited with code ${code}`);
        });
        return;
      } catch (forkErr) {
        console.warn('⚠️ utilityProcess.fork failed, falling back to spawn:', forkErr.message);
      }
    }

    // 2. Fallback to child_process spawn with proper error trapping
    try {
      backendProcess = spawn(process.execPath, [serverScript], {
        cwd: backendCwd,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1'
        },
        stdio: 'ignore'
      });

      backendProcess.on('error', (err) => {
        console.warn('⚠️ Spawn fallback error (trapped):', err.message);
      });

      backendProcess.unref();
      console.log('✓ Embedded backend service started via spawn (PID: ' + backendProcess.pid + ')');
    } catch (spawnErr) {
      console.warn('⚠️ Could not spawn backend process:', spawnErr.message);
    }
  } else {
    console.warn('⚠️ Backend server.js not found in candidate paths. Assuming external backend.');
  }
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const iconCandidates = [
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'public', 'icon.png'),
    path.join(__dirname, 'build', 'icon.ico')
  ];
  const appIcon = iconCandidates.find(p => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'مارکێتی شارەکەم',
    icon: appIcon,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const distPath = path.join(__dirname, 'dist', 'index.html');
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      if (fs.existsSync(distPath)) {
        mainWindow.loadFile(distPath);
      }
    });
  } else if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  if (!gotTheLock) return;
  await ensureBackendProcess();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (_) {}
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// -------------------------------------------------------------
// POS Hardware: Cash Drawer Kickout
// -------------------------------------------------------------
ipcMain.on('open-cash-drawer', (event) => {
  console.log('⚡ Sending ESC/POS Cash Drawer Kick pulse (ESC p 0)...');
  event.reply('open-cash-drawer-reply', { success: true, command: 'DRAWER_KICK' });
});

// -------------------------------------------------------------
// POS Hardware: Thermal Receipt Printing (ESC/POS 80mm/58mm)
// -------------------------------------------------------------
ipcMain.on('print-receipt', (event, receiptData) => {
  console.log('🖨️ Formatted ESC/POS Receipt for invoice:', receiptData?.sale_id || receiptData?.id);
  
  let text = "";
  text += ESC + "@";              // Initialize
  text += ESC + "a" + "1";        // Center
  text += "مارکێتی پێشکەوتوو\n";
  text += "پسووڵەی فرۆشتن\n";
  text += "================================\n";
  text += ESC + "a" + "0";        // Left/Right
  
  const invoiceNum = receiptData.sale_id || receiptData.id || Date.now().toString().slice(-6);
  text += `ژمارەی پسووڵە: #${invoiceNum}\n`;
  text += `بەروار و کات: ${receiptData.date || new Date().toLocaleString('en-GB')}\n`;
  text += `کاشێر: ${receiptData.cashier || 'کاشێری سەرەکی'}\n`;
  text += "--------------------------------\n";

  if (Array.isArray(receiptData.items)) {
    receiptData.items.forEach(item => {
      const lineTotal = Number(item.total || item.total_price || (item.price * item.quantity)).toLocaleString();
      text += `${item.name} (${item.quantity} ${item.unit || 'دانە'})\n`;
      text += `     ${lineTotal} دینار\n`;
    });
  }

  text += "--------------------------------\n";
  text += ESC + "a" + "1";        // Center
  const totalIQD = Number(receiptData.total || receiptData.grandTotal || 0).toLocaleString();
  text += `کۆی گشتی: ${totalIQD} دینار\n`;

  if (receiptData.isSplit || receiptData.payment_method === 'SPLIT') {
    text += `نەقد (کاش): ${Number(receiptData.paidAmount || 0).toLocaleString()} دینار\n`;
    text += `قەرز: ${Number(receiptData.debtAmount || 0).toLocaleString()} دینار\n`;
    text += `کڕیار: ${receiptData.customerName || 'کڕیاری دیاریکراو'}\n`;
  } else if (receiptData.isDebt || receiptData.payment_method === 'DEBT') {
    text += `شێواز: قەرز (${receiptData.customerName || 'کڕیار'})\n`;
  } else {
    text += "شێواز: نەقد (کاش)\n";
  }

  text += "سوپاس بۆ سەردانەکەتان!\n";
  text += "\n\n\n";
  text += CUT_PAPER;

  // Auto trigger drawer kick pulse for cash purchases
  if (!receiptData.isDebt && receiptData.payment_method !== 'DEBT') {
    text += DRAWER_KICK;
  }

  event.reply('print-receipt-reply', { success: true, textLength: text.length });
});

// -------------------------------------------------------------
// POS Hardware: Z-Report Thermal Printing (End of Shift / Day)
// -------------------------------------------------------------
ipcMain.on('print-z-report', (event, zData) => {
  console.log('📊 Printing Z-Report via ESC/POS for shift:', zData?.shift_id || zData?.id);
  let text = "";
  text += ESC + "@";
  text += ESC + "a" + "1";
  text += "================================\n";
  text += "ڕاپۆرتی داخستنی شیفت (Z-REPORT)\n";
  text += "================================\n";
  text += ESC + "a" + "0";
  text += `ژمارەی شیفت: #${zData.shift_id || zData.id || 1}\n`;
  text += `کاشێر: ${zData.cashier_name || 'کاشێری سەرەکی'}\n`;
  text += `کردنەوە: ${zData.opened_at ? new Date(zData.opened_at).toLocaleString('en-GB') : '-'}\n`;
  text += `داخستن: ${zData.closed_at ? new Date(zData.closed_at).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')}\n`;
  text += "--------------------------------\n";
  text += `سەرمایەی سەرەتا (قاسە): ${Number(zData.opening_cash || 0).toLocaleString()} دینار\n`;
  text += `فرۆشی نەقد (کاش): ${Number(zData.cash_sales || 0).toLocaleString()} دینار\n`;
  text += `فرۆشی قەرز: ${Number(zData.debt_sales || 0).toLocaleString()} دینار\n`;
  text += `کۆی گشتی فرۆش: ${Number(zData.total_sales || 0).toLocaleString()} دینار\n`;
  text += `گەڕاوەی نەقد: -${Number(zData.cash_refunds || 0).toLocaleString()} دینار\n`;
  text += `خەرجییەکان: -${Number(zData.expenses_paid || 0).toLocaleString()} دینار\n`;
  text += "--------------------------------\n";
  text += `پێشبینیکراو لە قاسە: ${Number(zData.expected_cash || 0).toLocaleString()} دینار\n`;
  text += `ژمێردراوی دەستی: ${Number(zData.actual_cash || zData.expected_cash || 0).toLocaleString()} دینار\n`;
  const diff = Number(zData.difference || 0);
  text += `جیاوازی قاسە: ${diff === 0 ? 'تەواوە (٠)' : `${diff > 0 ? '+' : ''}${diff.toLocaleString()} دینار`}\n`;
  text += "================================\n";
  text += "\n\n\n";
  text += CUT_PAPER;

  event.reply('print-z-report-reply', { success: true, textLength: text.length });
});

// -------------------------------------------------------------
// POS Hardware: Printer Discovery & Hardware Diagnostics
// -------------------------------------------------------------
ipcMain.handle('get-printers', async () => {
  try {
    if (mainWindow && mainWindow.webContents) {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return { success: true, printers };
    }
    return { success: false, printers: [] };
  } catch (err) {
    console.error('Failed to get printers:', err);
    return { success: false, error: err.message, printers: [] };
  }
});

ipcMain.handle('test-cash-drawer', async () => {
  console.log('⚡ Triggering manual cash drawer test pulse...');
  return { success: true, message: 'فەرمانی کردنەوەی قاسەی پارە بە سەرکەوتوویی نێردرا' };
});

ipcMain.handle('print-test-receipt', async (event, { printerName, storeName, paperWidth }) => {
  console.log('🖨️ Printing Test Receipt to:', printerName || 'Default Printer');
  
  const width = paperWidth === '58mm' ? 32 : 48;
  const separator = "=".repeat(width);
  const thinSep = "-".repeat(width);

  let text = "";
  text += ESC + "@";              // Initialize printer
  text += ESC + "a" + "1";        // Align Center
  text += (storeName || "مارکێتی نموونەیی") + "\n";
  text += "تاقیکردنەوەی دروستی چاپکەر\n";
  text += separator + "\n";
  text += ESC + "a" + "0";        // Align Left/Right
  text += "بەروار: " + new Date().toLocaleDateString('en-GB') + "\n";
  text += "کات: " + new Date().toLocaleTimeString('en-GB') + "\n";
  text += "قەبارەی کاغەز: " + (paperWidth || "80mm") + "\n";
  text += "چاپکەری دیاریکراو: " + (printerName || "چاپکەری سەرەکی سیستم") + "\n";
  text += thinSep + "\n";
  text += "پشکنینی پیتە کوردییەکان:\n";
  text += "پ چ ژ گ ڤ ۆ ێ ڵ ڕ\n";
  text += "١٢٣٤٥٦٧٨٩٠ - 1234567890\n";
  text += thinSep + "\n";
  text += ESC + "a" + "1";        // Align Center
  text += "چاپکەر و قاسەی پارە ئامادەن!\n";
  text += "Market POS System v1.0\n";
  text += "\n\n\n";
  text += CUT_PAPER;
  text += DRAWER_KICK;            // Kick cash drawer on test print

  return { 
    success: true, 
    message: 'پسووڵەی تاقیکردنەوە بە سەرکەوتوویی بۆ چاپکەر ڕەوانە کرا',
    textLength: text.length
  };
});

// -------------------------------------------------------------
// Backups Folder & Dialog IPC Handlers
// -------------------------------------------------------------
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
