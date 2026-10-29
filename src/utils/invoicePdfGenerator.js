import axios from 'axios';
import { toast } from '../context/ToastContext';

// Safe Electron IPC Detection
let ipcRenderer = null;
if (typeof window !== 'undefined' && typeof window.require === 'function') {
  try {
    const electron = window.require('electron');
    ipcRenderer = electron?.ipcRenderer || null;
  } catch (_) {}
}

/**
 * Generate Clean, Simple, Lightweight A4 Purchase Invoice HTML.
 * Features:
 * - Single horizontal line for totals and item count ("کۆی کاڵاکان")
 * - Completely box-free, minimal aesthetic
 * - No signatures
 */
export const generateA4InvoiceHTML = (invoiceData, storeName, storePhone) => {
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const hasAddCost = Number(invoiceData.additionalCost || 0) > 0;
  const isPaid = Number(invoiceData.remainingAmount || 0) <= 0;

  const rows = (invoiceData.items || []).map((item, idx) => {
    return `
      <tr>
        <td style="text-align: center; width: 35px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: right; font-weight: 700; color: #0f172a;">${item.name || ''}</td>
        <td style="text-align: center; font-family: monospace; direction: ltr; color: #475569;">${item.barcode || '---'}</td>
        <td style="text-align: center; font-weight: 700; color: #0f172a;">${item.quantity || ''}</td>
        <td style="text-align: center;">${fmt(item.cost_price)} د.ع</td>
        ${hasAddCost ? `<td style="text-align: center; color: #0284c7;">${fmt(item.landedUnitCost)} د.ع</td>` : ''}
        <td style="text-align: center; font-weight: 700; color: #0f172a;">${fmt(item.total)} د.ع</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ckb" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>پسووڵەی کڕین - ${invoiceData.invoiceNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #ffffff;
      color: #1e293b;
      font-size: 11px;
      line-height: 1.4;
    }
    
    /* Top Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .store-name {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .store-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .invoice-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      text-align: left;
    }
    .invoice-no {
      font-size: 11px;
      color: #475569;
      font-weight: 700;
      direction: ltr;
      text-align: left;
    }

    /* Meta Info: Completely Open, NO BOX */
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding: 0 4px;
    }
    .meta-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .meta-lbl {
      color: #64748b;
      min-width: 90px;
    }
    .meta-val {
      color: #0f172a;
      font-weight: 700;
    }

    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .items-table th {
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 7px 8px;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }
    .items-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 11px;
    }
    .items-table tbody tr:nth-child(even) {
      background: #fbfcfd;
    }

    /* Single Clean Horizontal Summary Line (NO BOXES, NO VERTICAL STACK) */
    .summary-line-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1.5px solid #0f172a;
      padding: 9px 6px;
      margin-top: 8px;
      font-size: 11px;
      direction: rtl;
      gap: 12px;
      flex-wrap: wrap;
    }
    .sum-part {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .sum-lbl {
      color: #64748b;
      font-size: 11px;
    }
    .sum-val {
      font-weight: 700;
      color: #0f172a;
      font-size: 11px;
    }
    .sum-val.grand-total {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
    }

    .doc-foot {
      margin-top: 25px;
      border-top: 1px solid #f1f5f9;
      padding-top: 6px;
      font-size: 9.5px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div>
      <div class="store-name">${storeName || 'مارکێتی شارەکەم'}</div>
      <div class="store-sub">${storePhone ? `پەیوەندی: ${storePhone}` : 'وەسڵی کڕین و تۆمارکردنی کاڵا'}</div>
    </div>
    <div>
      <div class="invoice-title">پسووڵەی کڕین</div>
      <div class="invoice-no">${invoiceData.invoiceNumber}</div>
    </div>
  </div>

  <!-- Meta Info: Clean & Open, NO BOX -->
  <div class="meta-row">
    <div class="meta-group">
      <div class="meta-item">
        <span class="meta-lbl">کۆمپانیا / دابینکەر:</span>
        <span class="meta-val">${invoiceData.supplierName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">شێوازی پارەدان:</span>
        <span class="meta-val">${invoiceData.paymentMethod}</span>
      </div>
      ${invoiceData.supplierPhone ? `
      <div class="meta-item">
        <span class="meta-lbl">ژمارەی مۆبایل:</span>
        <span class="meta-val" style="direction: ltr;">${invoiceData.supplierPhone}</span>
      </div>` : ''}
    </div>

    <div class="meta-group">
      <div class="meta-item">
        <span class="meta-lbl">ژمارەی پسووڵە:</span>
        <span class="meta-val" style="direction: ltr;">${invoiceData.invoiceNumber}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">بەرواری پسووڵە:</span>
        <span class="meta-val">${invoiceData.date}</span>
      </div>
    </div>
  </div>

  <!-- Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th style="text-align: right;">ناوی کاڵا</th>
        <th style="width: 130px;">بارکۆد</th>
        <th style="width: 80px;">بڕ</th>
        <th style="width: 100px;">نرخی کڕین</th>
        ${hasAddCost ? '<th style="width: 100px;">تێچووی دانە</th>' : ''}
        <th style="width: 110px;">کۆی گشتی</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- Single Horizontal Line for Totals & Item Count (NO BOXES) -->
  <div class="summary-line-bar">
    <div class="sum-part">
      <span class="sum-lbl">کۆی کاڵاکان:</span>
      <span class="sum-val">${(invoiceData.items || []).length}</span>
    </div>
    ${hasAddCost ? `
    <div class="sum-part">
      <span class="sum-lbl">خەرجی زیادە:</span>
      <span class="sum-val" style="color: #0284c7;">+ ${fmt(invoiceData.additionalCost)} د.ع</span>
    </div>` : ''}
    <div class="sum-part">
      <span class="sum-lbl">کۆی گشتی پسووڵە:</span>
      <span class="sum-val grand-total">${fmt(invoiceData.totalInvoiceCost)} د.ع</span>
    </div>
    <div class="sum-part">
      <span class="sum-lbl">بڕی دراو:</span>
      <span class="sum-val" style="color: #16a34a;">${fmt(invoiceData.paidAmount)} د.ع</span>
    </div>
    <div class="sum-part">
      <span class="sum-lbl">بڕی ماوە:</span>
      <span class="sum-val" style="color: ${isPaid ? '#0f172a' : '#dc2626'};">
        ${fmt(invoiceData.remainingAmount)} د.ع
      </span>
    </div>
  </div>

  <div class="doc-foot">
    بەرواری چاپ: ${new Date().toLocaleDateString('en-GB')}
  </div>
</body>
</html>`;
};

/**
 * Normalizes database invoice structure into the standard format for PDF generation.
 */
export const formatInvoiceDataForPdf = (inv) => {
  if (!inv) return null;

  const fmtDate = (d) => {
    if (!d) return new Date().toLocaleDateString('en-GB');
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB');
  };

  const items = (inv.items || []).map((item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.cost_price) || 0;
    const landed = Number(item.landed_cost_price) || cost;
    const unitsPerBox = Math.max(1, Number(item.units_per_box) || 1);
    
    // Check if item was bought as a Box / Carton
    const isBox = item.unit_type === 'BOX' || (unitsPerBox > 1 && (Number(item.box_quantity) > 0 || (qty % unitsPerBox === 0 && qty >= unitsPerBox)));

    let unitDesc = `${qty} دانە`;
    let displayCost = cost;
    let displayLanded = landed;
    let displayTotal = Number(item.line_total) || (cost * qty);

    if (isBox) {
      const bQty = Number(item.box_quantity) > 0 
        ? Number(item.box_quantity) 
        : Math.max(1, Math.round(qty / unitsPerBox));
      unitDesc = `${bQty} کارتۆن`;
      displayCost = Number(item.box_cost_price) || (item.line_total ? Math.round(Number(item.line_total) / bQty) : Math.round(cost * unitsPerBox));
      displayLanded = displayCost + (landed > cost ? Math.round((landed - cost) * unitsPerBox) : 0);
      displayTotal = Number(item.line_total) || (displayCost * bQty);
    }

    return {
      name: item.product_name || item.name || '',
      barcode: item.barcode || '',
      quantity: unitDesc,
      cost_price: displayCost,
      landedUnitCost: displayLanded,
      total: displayTotal
    };
  });

  const totalInvoice = Number(inv.total_amount) || (Number(inv.paid_amount || 0) + Number(inv.remaining_amount || 0));
  const addCost = Number(inv.additional_cost || 0);
  const itemsSubtotal = totalInvoice - addCost;

  let paymentMethodLabel = 'نەقد';
  if (inv.payment_method === 'DEBT') paymentMethodLabel = 'قەرز';
  else if (inv.payment_method === 'PARTIAL') paymentMethodLabel = 'بەشێک قەرز';

  return {
    invoiceNumber: inv.invoice_number || `INV-${inv.id}`,
    supplierName: inv.supplier_name || 'کڕینی ناوخۆیی',
    supplierPhone: inv.supplier_phone || '',
    date: fmtDate(inv.created_at || inv.date),
    paymentMethod: paymentMethodLabel,
    paidAmount: Number(inv.paid_amount || 0),
    remainingAmount: Number(inv.remaining_amount || 0),
    itemsSubtotal,
    additionalCost: addCost,
    totalInvoiceCost: totalInvoice,
    items
  };
};

/**
 * Universal PDF Exporter (DRY Principle):
 * Works seamlessly in both Electron desktop and modern web browsers (Chrome/Edge).
 */
export const exportInvoiceToPdf = async (invData, storeName, storePhone, preSelectedFileHandle = null) => {
  if (!invData) return false;
  const cleanInvNum = (invData.invoiceNumber || 'purchase').replace(/[^a-zA-Z0-9_-]/g, '_');
  const defaultFileName = `Invoice_${cleanInvNum}.pdf`;
  const htmlContent = generateA4InvoiceHTML(invData, storeName, storePhone);

  // Mode 1: Electron Desktop App
  if (ipcRenderer) {
    try {
      const saveRes = await ipcRenderer.invoke('save-invoice-pdf', {
        defaultFileName,
        htmlContent
      });
      if (saveRes?.success) {
        return true;
      } else if (saveRes?.error) {
        toast.error(`هەڵە لە دروستکردنی فایلی PDF: ${saveRes.error}`);
        return false;
      }
    } catch (ipcErr) {
      console.warn('IPC failed, falling back to web API:', ipcErr);
    }
  }

  // Mode 2: Web Browser (Chrome/Edge)
  try {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await axios.post('http://localhost:3001/api/purchase-invoices/generate-pdf', {
      htmlContent
    }, {
      headers,
      responseType: 'blob'
    });

    const pdfBlob = new Blob([res.data], { type: 'application/pdf' });

    // If user already chose a file destination via prompt
    if (preSelectedFileHandle) {
      const writable = await preSelectedFileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return true;
    }

    // Native Windows "Save As" file dialog (Chrome / Edge)
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: defaultFileName,
          types: [{
            description: 'فایلی PDF پسووڵە',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        return true;
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') {
          return false;
        }
        console.warn('showSaveFilePicker error, falling back to direct download:', pickerErr);
      }
    }

    // Fallback: direct download link if showSaveFilePicker is unsupported
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }, 500);
    return true;

  } catch (err) {
    console.error('PDF export error:', err);
    const msg = err.response?.data?.message || err.message || 'هەڵەیەکی نەزانراو';
    toast.error(`کێشەیەک لە کاتی دروستکردنی فایلی PDF ڕوویدا: ${msg}`);
    return false;
  }
};
