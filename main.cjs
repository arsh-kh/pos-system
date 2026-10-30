const { app, BrowserWindow, Menu, ipcMain, dialog, shell, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

// Enterprise POS: Completely suppress all print dialogs and print directly to thermal printer
app.commandLine.appendSwitch('kiosk-printing');

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

// -------------------------------------------------------------
// POS Hardware: Unified Robust Thermal Printing Engine (XP-80C / ESC-POS / Windows Spooler)
// -------------------------------------------------------------
async function printHtmlReceipt({ htmlContent, deviceName, paperWidth = '80mm', silent = true }) {
  let printWin = null;
  let tempPath = null;
  return new Promise(async (resolve) => {
    try {
      if (!mainWindow || !mainWindow.webContents) {
        return resolve({ success: false, error: 'Main window unavailable' });
      }

      const printers = await mainWindow.webContents.getPrintersAsync();
      let targetPrinter = deviceName;
      if (!targetPrinter) {
        const xpPrinter = printers.find(p => 
          p.name.toLowerCase().includes('xp-80') || 
          p.name.toLowerCase().includes('pos-80') || 
          p.name.toLowerCase().includes('80c') ||
          p.name.toLowerCase().includes('thermal')
        );
        targetPrinter = xpPrinter ? xpPrinter.name : (printers.find(p => p.isDefault)?.name || '');
      }

      const is58 = paperWidth === '58mm';
      const bodyWidth = is58 ? '48mm' : '72mm';
      const wrapperWidth = is58 ? '46mm' : '70mm';

      const standaloneHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ckb">
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: ${is58 ? '48mm' : '72mm'} auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${bodyWidth} !important;
      max-width: ${bodyWidth} !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif !important;
      font-size: 12px !important;
      direction: rtl !important;
      text-align: right !important;
      overflow: visible !important;
      height: auto !important;
    }
    .thermal-receipt-wrapper {
      width: ${wrapperWidth} !important;
      margin: 0 auto !important;
      padding: 4px 2px 25mm 2px !important;
      box-sizing: border-box !important;
      color: #000000 !important;
      background: #ffffff !important;
    }
    .receipt-divider {
      border-bottom: 1px dashed #000000 !important;
      margin: 6px 0 !important;
      width: 100% !important;
    }
    table {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      border: 1px solid #000000 !important;
      direction: rtl !important;
      margin: 5px 0 !important;
      color: #000000 !important;
      page-break-inside: avoid !important;
    }
    th, td {
      border: 1px solid #000000 !important;
      color: #000000 !important;
      font-weight: bold !important;
      padding: 3px 2px !important;
    }
    svg {
      display: block !important;
      margin: 0 auto !important;
      max-width: 100% !important;
      height: auto !important;
    }
  </style>
</head>
<body>
  <div class="thermal-receipt-wrapper">
    ${htmlContent}
  </div>
</body>
</html>`;

      tempPath = path.join(app.getPath('temp'), `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.html`);
      fs.writeFileSync(tempPath, standaloneHtml, 'utf8');

      printWin = new BrowserWindow({
        show: true,
        x: -9999,
        y: -9999,
        width: 350,
        height: 800,
        frame: false,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          backgroundThrottling: false
        }
      });

      await printWin.loadFile(tempPath);
      await new Promise(r => setTimeout(r, 200));

      const printOpts = {
        silent: Boolean(silent),
        printBackground: true,
        margins: { marginType: 'none' }
      };
      if (targetPrinter) {
        printOpts.deviceName = targetPrinter;
      }

      console.log('🖨️ Dispatching thermal print job to:', targetPrinter || 'Default Printer', 'silent:', silent);

      const doPrint = (opts) => {
        return new Promise((res) => {
          printWin.webContents.print(opts, (success, failureReason) => {
            res({ success, failureReason });
          });
        });
      };

      let result = await doPrint(printOpts);

      // Fallback: If printing to named printer failed, retry on system default printer
      if (!result.success && targetPrinter) {
        console.warn('⚠️ Named printer failed, retrying on system default printer...', result.failureReason);
        result = await doPrint({
          silent: Boolean(silent),
          printBackground: true,
          margins: { marginType: 'none' }
        });
      }

      try { fs.unlinkSync(tempPath); } catch (_) {}

      // Keep print window alive briefly so Windows spooler completes reading EMF data
      setTimeout(() => {
        try {
          if (printWin && !printWin.isDestroyed()) printWin.destroy();
        } catch (_) {}
      }, 3000);

      if (result.success) {
        console.log('✅ Thermal receipt printed successfully to:', targetPrinter || 'Default Printer');
        resolve({ success: true });
      } else {
        console.warn('⚠️ Thermal print failed:', result.failureReason);
        resolve({ success: false, error: result.failureReason || 'چاپ نەکرا' });
      }
    } catch (err) {
      if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
      if (printWin && !printWin.isDestroyed()) { try { printWin.destroy(); } catch (_) {} }
      console.error('Thermal print fatal error:', err);
      resolve({ success: false, error: err.message });
    }
  });
}

// Handler for regular sales & reprint receipts
ipcMain.handle('print-thermal-receipt', async (event, options = {}) => {
  return await printHtmlReceipt(options);
});

// Handler for hardware test receipt in Settings
ipcMain.handle('print-test-receipt', async (event, { printerName, storeName, paperWidth, silent = true }) => {
  console.log('🖨️ Handling test receipt request for printer:', printerName || 'Default');
  const testHtml = `
    <div style="text-align: center; font-size: 16px; font-weight: 800; margin-bottom: 2px;">${storeName || 'مارکێتی شارەکەم'}</div>
    <div style="text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 4px;">تاقیکردنەوەی دروستی چاپکەر</div>
    <div class="receipt-divider"></div>
    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 2px 0;"><span>بەروار:</span><span>${new Date().toLocaleDateString('en-GB')}</span></div>
    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 2px 0;"><span>کات:</span><span>${new Date().toLocaleTimeString('en-GB')}</span></div>
    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 2px 0;"><span>چاپکەر:</span><span>${printerName || 'چاپکەری سەرەکی'}</span></div>
    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 2px 0;"><span>قەبارە:</span><span>${paperWidth || '80mm'}</span></div>
    <div class="receipt-divider"></div>
    <div style="font-size: 12px; font-weight: bold; margin: 4px 0; text-align: center;">پشکنینی فۆنت و پیتە کوردییەکان:</div>
    <div style="font-size: 14px; font-weight: bold; letter-spacing: 1px; margin: 3px 0; text-align: center;">پ چ ژ گ ڤ ۆ ێ ڵ ڕ</div>
    <div style="font-size: 12px; font-weight: bold; text-align: center;">١٢٣٤٥٦٧٨٩٠ - 1234567890</div>
    <div class="receipt-divider"></div>
    <div style="font-size: 13px; font-weight: 800; margin-top: 4px; text-align: center;">چاپکەر ئامادەیە بۆ کارکردن! ✅</div>
    <div style="font-size: 10px; color: #444; margin-top: 2px; text-align: center;">Market POS System</div>
  `;
  return await printHtmlReceipt({
    htmlContent: testHtml,
    deviceName: printerName,
    paperWidth: paperWidth || '80mm',
    silent: silent !== undefined ? silent : true
  });
});

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

// -------------------------------------------------------------
// Native A4 Invoice PDF Export via Dialog & printToPDF
// -------------------------------------------------------------
ipcMain.handle('save-invoice-pdf', async (event, { defaultFileName, htmlContent }) => {
  let pdfWindow = null;
  let tempHtmlPath = null;
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'پاشەکەوتکردنی پسووڵەی کڕین بە شێوەی فایلی PDF',
      defaultPath: defaultFileName || `purchase_invoice_${Date.now()}.pdf`,
      filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    tempHtmlPath = path.join(app.getPath('temp'), `inv_pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    pdfWindow = new BrowserWindow({
      show: false,
      width: 1024,
      height: 1400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await pdfWindow.loadFile(tempHtmlPath);

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'default'
      }
    });

    fs.writeFileSync(filePath, pdfBuffer);

    return { success: true, filePath };
  } catch (err) {
    console.error('Failed to export invoice PDF via dialog:', err);
    return { success: false, error: err.message };
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }
    if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
      try { fs.unlinkSync(tempHtmlPath); } catch (_) {}
    }
  }
});


