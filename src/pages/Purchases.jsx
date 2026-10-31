import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { normalizeBarcode } from '../utils/barcodeNormalizer';
import { formatDate } from '../utils/dateFormatter';
import ProductModal from '../components/ProductModal';
import { toast } from '../context/ToastContext';
import { generateA4InvoiceHTML, exportInvoiceToPdf } from '../utils/invoicePdfGenerator';
import './Dashboard.css';

// Safe Electron IPC Detection
let ipcRenderer = null;
if (typeof window !== 'undefined' && typeof window.require === 'function') {
  try {
    const electron = window.require('electron');
    ipcRenderer = electron?.ipcRenderer || null;
  } catch (_) {}
}

const Purchases = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Draft persistence helper
  const getInitialDraft = () => {
    try {
      const draft = JSON.parse(localStorage.getItem('pos_purchase_draft') || '{}');
      return draft && typeof draft === 'object' ? draft : {};
    } catch (_) { return {}; }
  };
  const initialDraft = getInitialDraft();

  // Invoice Header State
  const [supplierId, setSupplierId] = useState(() => initialDraft.supplierId || '');
  const [invoiceNumber, setInvoiceNumber] = useState(() => initialDraft.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(() => initialDraft.invoiceDate || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(() => initialDraft.paymentMethod || 'CASH'); // CASH, DEBT, PARTIAL
  const [paidAmount, setPaidAmount] = useState(() => initialDraft.paidAmount || '');
  const [additionalCost, setAdditionalCost] = useState(() => initialDraft.additionalCost || '');

  // Invoice Items State
  const [items, setItems] = useState(() => Array.isArray(initialDraft.items) ? initialDraft.items : []);

  // Barcode Scanner & Search State
  const [scanBarcode, setScanBarcode] = useState('');
  const scanInputRef = useRef(null);
  const [productSearch, setProductSearch] = useState('');

  // Quick Add Product Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState('');

  // Printable Invoice Voucher State
  const [printedInvoice, setPrintedInvoice] = useState(null);
  const [companyWarningOpen, setCompanyWarningOpen] = useState(false);
  const [invoiceErrorMessage, setInvoiceErrorMessage] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم';
  const storePhone = localStorage.getItem('pos_store_phone') || '';

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products.filter(p => kurdishSearchMatch([p.name, p.barcode, p.box_barcode], productSearch)).slice(0, 10);
  }, [products, productSearch]);

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchData = async () => {
    try {
      const config = getAuthConfig();
      const [supRes, prodRes, catRes] = await Promise.all([
        axios.get('http://localhost:3001/api/suppliers'),
        axios.get('http://localhost:3001/api/products', config),
        axios.get('http://localhost:3001/api/categories', config)
      ]);
      if (supRes.data.status === 'SUCCESS') setSuppliers(supRes.data.data);
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
      if (catRes.data.status === 'SUCCESS') setCategories(catRes.data.data);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-sync draft to localStorage
  useEffect(() => {
    if (items.length > 0 || supplierId) {
      try {
        localStorage.setItem('pos_purchase_draft', JSON.stringify({
          supplierId,
          invoiceNumber,
          invoiceDate,
          paymentMethod,
          paidAmount,
          additionalCost,
          items
        }));
      } catch (err) {
        console.error('Failed to save purchase draft:', err);
      }
    } else {
      localStorage.removeItem('pos_purchase_draft');
    }
  }, [supplierId, invoiceNumber, invoiceDate, paymentMethod, paidAmount, additionalCost, items]);

  const openQuickAddModal = (presetBarcode = '') => {
    setQuickAddBarcode(presetBarcode || '');
    setIsQuickAddOpen(true);
  };

  const handleProcessBarcode = (code) => {
    if (!code) return;
    const cleanCode = normalizeBarcode(code).trim();
    const existing = products.find(p => 
      normalizeBarcode(p.barcode) === cleanCode || 
      (p.box_barcode && normalizeBarcode(p.box_barcode) === cleanCode)
    );

    if (existing) {
      const isWeighted = Boolean(existing.is_weighted || existing.unit === 'کگم');
      const unitsPerBox = (!isWeighted && existing.units_per_box) ? Math.max(1, parseFloat(existing.units_per_box) || 1) : 1;
      const isScannedBox = Boolean(!isWeighted && existing.box_barcode && normalizeBarcode(existing.box_barcode) === cleanCode);
      const initialUnitType = isScannedBox ? 'BOX' : (unitsPerBox > 1 ? 'BOX' : 'PIECE');

      setItems(prevItems => {
        const itemIdx = prevItems.findIndex(i => i.product_id === existing.id);
        if (itemIdx >= 0) {
          const updated = [...prevItems];
          const it = { ...updated[itemIdx] };
          if (it.unit_type === 'BOX') {
            const newBoxQty = (parseFloat(it.box_quantity) || 0) + 1;
            it.box_quantity = String(newBoxQty);
            it.quantity = String(Math.round(newBoxQty * unitsPerBox));
          } else {
            const newQty = (parseFloat(it.quantity) || 0) + 1;
            it.quantity = String(newQty);
            it.box_quantity = unitsPerBox > 0 ? String(parseFloat((newQty / unitsPerBox).toFixed(2)) || 0) : String(newQty);
          }
          updated[itemIdx] = it;
          return updated;
        } else {
          const pieceCost = Number(existing.cost_price) || 0;
          const boxCost = existing.box_cost_price 
            ? Number(existing.box_cost_price) 
            : Math.round(pieceCost * unitsPerBox);
          // When bought by Carton, dynamically calculate Cost per Piece = (Carton Price / Pieces per Carton)
          const effectivePieceCost = (initialUnitType === 'BOX' && unitsPerBox > 0)
            ? Math.round(boxCost / unitsPerBox)
            : (pieceCost || (unitsPerBox > 0 ? Math.round(boxCost / unitsPerBox) : 0));

          return [
            ...prevItems,
            {
              product_id: existing.id,
              name: existing.name,
              barcode: existing.barcode,
              box_barcode: existing.box_barcode || '',
              units_per_box: unitsPerBox,
              unit_type: initialUnitType,
              box_quantity: '1',
              box_cost_price: String(boxCost),
              quantity: initialUnitType === 'BOX' ? String(unitsPerBox) : '1',
              cost_price: String(effectivePieceCost),
              selling_price: existing.selling_price || 0,
              stock_before: existing.stock || 0,
              is_weighted: isWeighted,
              unit: isWeighted ? 'کگم' : (existing.unit || 'دانە')
            }
          ];
        }
      });
    } else {
      openQuickAddModal(cleanCode);
    }
    setScanBarcode('');
    scanInputRef.current?.focus();
  };

  useBarcodeScanner((scannedCode) => {
    handleProcessBarcode(scannedCode);
  });

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (scanBarcode) {
      handleProcessBarcode(scanBarcode);
    }
  };

  const handleQuickAddSuccess = (newProd) => {
    const isWeighted = Boolean(newProd.is_weighted || newProd.unit === 'کگم');
    const unitsPerBox = (!isWeighted && newProd.units_per_box) ? Math.max(1, parseFloat(newProd.units_per_box) || 1) : 1;
    const boxCost = Math.max(0, Number(newProd.box_cost_price) || (Number(newProd.cost_price) * unitsPerBox) || 0);
    const pieceCost = Math.max(0, Number(newProd.cost_price) || 0);
    const initialUnitType = (!isWeighted && unitsPerBox > 1) ? 'BOX' : 'PIECE';

    let initialQty = '1';
    if (newProd.initial_qty !== null && newProd.initial_qty !== undefined && !isNaN(Number(newProd.initial_qty)) && Number(newProd.initial_qty) > 0) {
      initialQty = String(newProd.initial_qty);
    } else if (initialUnitType === 'BOX') {
      initialQty = String(unitsPerBox);
    }

    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.product_id === newProd.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const it = { ...updated[existingIdx] };
        if (it.unit_type === 'BOX') {
          const newBoxQty = (parseFloat(it.box_quantity) || 0) + 1;
          it.box_quantity = String(newBoxQty);
          it.quantity = String(Math.round(newBoxQty * unitsPerBox));
        } else {
          const added = parseFloat(initialQty) || 1;
          const newQty = (parseFloat(it.quantity) || 0) + added;
          it.quantity = String(newQty);
          it.box_quantity = unitsPerBox > 0 ? String(parseFloat((newQty / unitsPerBox).toFixed(2)) || 0) : String(newQty);
        }
        updated[existingIdx] = it;
        return updated;
      }
      const effectivePieceCost = (initialUnitType === 'BOX' && unitsPerBox > 0)
        ? Math.round(boxCost / unitsPerBox)
        : pieceCost;

      return [
        ...prev,
        {
          product_id: newProd.id,
          name: newProd.name,
          barcode: newProd.barcode,
          box_barcode: newProd.box_barcode || '',
          units_per_box: unitsPerBox,
          unit_type: initialUnitType,
          box_quantity: '1',
          box_cost_price: String(boxCost || (pieceCost * unitsPerBox)),
          quantity: initialQty,
          cost_price: String(effectivePieceCost),
          selling_price: newProd.selling_price || 0,
          stock_before: 0,
          is_draft: Boolean(newProd.is_draft),
          draft_payload: newProd.is_draft ? newProd : null,
          is_weighted: isWeighted,
          unit: isWeighted ? 'کگم' : (newProd.unit || 'دانە')
        }
      ];
    });

    if (!newProd.is_draft) {
      const config = getAuthConfig();
      axios.get('http://localhost:3001/api/products', config).then(res => {
        if (res.data?.status === 'SUCCESS') setProducts(res.data.data);
      }).catch(() => {});
    }
  };

  const updateItem = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      const it = { ...updated[index] };
      const unitsPerBox = Math.max(1, parseFloat(it.units_per_box) || 1);

      if (field === 'unit_type') {
        it.unit_type = value;
        if (value === 'BOX') {
          const prod = products.find(p => p.id === it.product_id);
          const currentMult = Math.max(1, parseFloat(it.last_box_multiplier) || parseFloat(it.units_per_box) || parseFloat(prod?.units_per_box) || 12);
          it.units_per_box = String(currentMult);
          it.last_box_multiplier = currentMult;

          // Convert pieces quantity to carton quantity: box_quantity = quantity / currentMult
          const totalPieces = parseFloat(it.quantity) || currentMult;
          const bQty = Math.max(0.001, parseFloat((totalPieces / currentMult).toFixed(3)));
          it.box_quantity = String(bQty);
          it.quantity = String(Math.round(bQty * currentMult));

          // Carton purchase price = piece purchase price * multiplier
          const pieceCost = (it.exact_cost_price !== undefined && it.exact_cost_price !== null && Number(it.exact_cost_price) > 0)
            ? Number(it.exact_cost_price)
            : (Number(it.cost_price) || 0);
          it.exact_cost_price = pieceCost;
          it.cost_price = String(Math.round(pieceCost));
          it.box_cost_price = String(Math.round(pieceCost * currentMult));
        } else {
          // If "دانە", input is DISABLED (grayed out visually) and defaults to 1
          const currentMult = Math.max(1, parseFloat(it.units_per_box) || parseFloat(it.last_box_multiplier) || 1);
          it.last_box_multiplier = currentMult;
          it.units_per_box = '1';

          // Ensure quantity is in single pieces
          const bQty = parseFloat(it.box_quantity) || 0;
          const totalPieces = Math.max(1, parseFloat(it.quantity) || (bQty * currentMult) || 1);
          it.quantity = String(Math.round(totalPieces));
          it.box_quantity = String(parseFloat((totalPieces / currentMult).toFixed(2)) || 1);

          // CRITICAL: Calculate single piece purchase price: pieceCost = carton_cost / multiplier
          let pieceCost = 0;
          if (it.exact_cost_price !== undefined && it.exact_cost_price !== null && Number(it.exact_cost_price) > 0) {
            pieceCost = Number(it.exact_cost_price);
          } else if (Number(it.box_cost_price) > 0 && currentMult > 1) {
            pieceCost = Number(it.box_cost_price) / currentMult;
          } else {
            pieceCost = Number(it.cost_price) || 0;
          }

          it.exact_cost_price = pieceCost;
          it.cost_price = String(Math.round(pieceCost));
          it.box_cost_price = String(Math.round(pieceCost * currentMult));
        }
      } else if (field === 'units_per_box') {
        it.units_per_box = value;
        const newUnits = Math.max(1, parseFloat(value) || 1);
        if (it.unit_type === 'BOX') {
          const bQty = Math.max(0.001, parseFloat(it.box_quantity) || 1);
          it.quantity = String(Math.round(bQty * newUnits));
          // Instantly recalculate Line Total based on this specific batch multiplier
          const pieceCost = (it.exact_cost_price !== undefined && it.exact_cost_price !== null)
            ? Number(it.exact_cost_price)
            : (Number(it.cost_price) || 0);
          it.box_cost_price = String(Math.round(pieceCost * newUnits));
        } else {
          it.units_per_box = '1';
        }
      } else if (field === 'box_quantity') {
        const mult = Math.max(1, parseFloat(it.units_per_box) || 1);
        if (value === '') {
          it.box_quantity = '';
          it.quantity = '';
        } else {
          const parsed = parseFloat(value);
          if (parsed < 0 || isNaN(parsed)) {
            it.box_quantity = '1';
            it.quantity = String(mult);
          } else {
            const safeVal = Math.max(0.001, parsed);
            it.box_quantity = value;
            it.quantity = String(Math.round(safeVal * mult));
          }
        }
      } else if (field === 'box_cost_price') {
        const mult = Math.max(1, parseFloat(it.units_per_box) || 1);
        if (value === '') {
          it.box_cost_price = '';
          it.cost_price = '';
          delete it.exact_cost_price;
        } else {
          const parsed = parseFloat(value);
          if (parsed < 0 || isNaN(parsed)) {
            it.box_cost_price = '0';
            it.cost_price = '0';
            it.exact_cost_price = 0;
          } else {
            const safeVal = Math.max(0, parsed);
            it.box_cost_price = value;
            it.exact_cost_price = mult > 0 ? (safeVal / mult) : safeVal;
            it.cost_price = String(Math.round(it.exact_cost_price));
          }
        }
      } else if (field === 'quantity') {
        const mult = Math.max(1, parseFloat(it.units_per_box) || 1);
        if (value === '') {
          it.quantity = '';
          it.box_quantity = '';
        } else {
          const parsed = parseFloat(value);
          if (parsed < 0 || isNaN(parsed)) {
            it.quantity = '1';
            it.box_quantity = mult > 0 ? String(parseFloat((1 / mult).toFixed(2))) : '1';
          } else {
            const safeVal = Math.max(0.001, parsed);
            it.quantity = value;
            it.box_quantity = mult > 0 ? String(parseFloat((safeVal / mult).toFixed(2)) || 0) : String(safeVal);
          }
        }
      } else if (field === 'cost_price') {
        const mult = Math.max(1, parseFloat(it.units_per_box) || 1);
        if (value === '') {
          it.cost_price = '';
          delete it.exact_cost_price;
          it.box_cost_price = '';
        } else {
          const parsed = parseFloat(value);
          if (parsed < 0 || isNaN(parsed)) {
            it.cost_price = '0';
            it.exact_cost_price = 0;
            it.box_cost_price = '0';
          } else {
            const safeVal = Math.max(0, parsed);
            it.cost_price = value;
            it.exact_cost_price = safeVal;
            it.box_cost_price = String(Math.round(safeVal * mult));
          }
        }
      } else if (field === 'selling_price') {
        if (value === '') {
          it.selling_price = '';
        } else {
          const parsed = parseFloat(value);
          if (parsed < 0 || isNaN(parsed)) {
            it.selling_price = '0';
          } else {
            it.selling_price = value;
          }
        }
      }

      updated[index] = it;
      return updated;
    });
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Mathematical Line Item Total Helper (Always: Quantity × Purchase Price, locking exact floating-point precision)
  const getItemLineTotal = (item) => {
    if (item.unit_type === 'BOX') {
      const bQty = Math.max(0, parseFloat(item.box_quantity) || 0);
      const bPrice = Math.max(0, parseFloat(item.box_cost_price) || 0);
      return Math.round(bQty * bPrice);
    } else {
      const pQty = Math.max(0, parseFloat(item.quantity) || 0);
      const pPrice = (item.exact_cost_price !== undefined && item.exact_cost_price !== null)
        ? Number(item.exact_cost_price)
        : Math.max(0, parseFloat(item.cost_price) || 0);
      return Math.round(pQty * pPrice);
    }
  };

  // Calculations: Subtotal, Shipping, Grand Total, Landed Cost Allocation
  const { 
    itemsSubtotal, 
    effectiveAdditionalCost, 
    totalInvoiceCost, 
    totalSalesValue, 
    totalProfit, 
    totalQty,
    itemsWithLandedCost 
  } = useMemo(() => {
    let cost = 0;
    let sales = 0;
    let qtySum = 0;

    items.forEach(item => {
      const q = Math.max(0, parseFloat(item.quantity) || 0);
      const sp = Math.max(0, Number(item.selling_price) || 0);
      const lineCost = getItemLineTotal(item);

      cost += lineCost;
      sales += sp * q;
      qtySum += q;
    });

    const addCost = Math.max(0, Math.round(Number(additionalCost) || 0));
    const grandTotal = cost + addCost;

    let remainingAdd = addCost;
    const itemsWithLanded = items.map((item, idx) => {
      const q = Math.max(0.001, parseFloat(item.quantity) || 1);
      const lineCost = getItemLineTotal(item);

      let allocated = 0;
      if (addCost > 0 && cost > 0) {
        if (idx === items.length - 1) {
          allocated = remainingAdd;
        } else {
          allocated = Math.round((addCost * lineCost) / cost);
          remainingAdd -= allocated;
        }
      }
      const perUnitAdd = Math.round(allocated / q);
      const landedUnitCost = Math.round(Number(item.cost_price) || 0) + perUnitAdd;

      return {
        ...item,
        allocatedCost: allocated,
        perUnitAdd,
        landedUnitCost
      };
    });

    return {
      itemsSubtotal: cost,
      effectiveAdditionalCost: addCost,
      totalInvoiceCost: grandTotal,
      totalSalesValue: sales,
      totalProfit: sales - grandTotal,
      totalQty: qtySum,
      itemsWithLandedCost: itemsWithLanded
    };
  }, [items, additionalCost]);

  // Synchronize Payment Method State with Absolute Accounting Rigor
  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setPaidAmount(String(totalInvoiceCost));
    } else if (paymentMethod === 'DEBT') {
      setPaidAmount('0');
    } else if (paymentMethod === 'PARTIAL') {
      const currentPaid = Number(paidAmount) || 0;
      if (currentPaid > totalInvoiceCost) {
        setPaidAmount(String(totalInvoiceCost));
      }
    }
  }, [paymentMethod, totalInvoiceCost]);

  const effectivePaid = paymentMethod === 'CASH' 
    ? totalInvoiceCost 
    : (paymentMethod === 'DEBT' ? 0 : Math.min(totalInvoiceCost, Math.max(0, Math.round(Number(paidAmount) || 0))));
  const totalRemaining = Math.max(0, totalInvoiceCost - effectivePaid);

  const handlePaidAmountChange = (val) => {
    if (val === '') {
      setPaidAmount('');
      return;
    }
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) {
      setPaidAmount('0');
      return;
    }
    if (parsed > totalInvoiceCost) {
      setPaidAmount(String(totalInvoiceCost));
    } else {
      setPaidAmount(val);
    }
  };

  const isSaveDisabled = isSubmitting || items.length === 0;

  const handleExportPDF = async (invData, preSelectedFileHandle = null) => {
    return await exportInvoiceToPdf(invData, storeName, storePhone, preSelectedFileHandle);
  };

  const onSaveAndPdf = async () => {
    if (!supplierId) {
      setCompanyWarningOpen(true);
      return;
    }
    if (items.length === 0) {
      toast.error('تکایە لانیکەم یەک کاڵا زیاد بکە');
      return;
    }
    if (effectivePaid < 0 || effectivePaid > totalInvoiceCost) {
      toast.error('بڕی پارەی دراو نادروستە');
      return;
    }

    let fileHandle = null;
    // In web browser (Chrome), open the native Windows Save dialog IMMEDIATELY upon user click!
    if (!ipcRenderer && typeof window.showSaveFilePicker === 'function') {
      try {
        const cleanInvNum = (invoiceNumber || `INV-${Date.now().toString().slice(-6)}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        fileHandle = await window.showSaveFilePicker({
          suggestedName: `Invoice_${cleanInvNum}.pdf`,
          types: [{
            description: 'فایلی PDF پسووڵە',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') {
          // User clicked Cancel on the file dialog - abort without saving
          return;
        }
      }
    }

    await handleSaveInvoice(true, fileHandle);
  };

  const handleSaveInvoice = async (exportPdf = false, preSelectedFileHandle = null) => {
    if (!supplierId) {
      setCompanyWarningOpen(true);
      return;
    }
    if (items.length === 0) {
      toast.error('تکایە لانیکەم یەک کاڵا زیاد بکە');
      return;
    }
    if (effectivePaid < 0 || effectivePaid > totalInvoiceCost) {
      toast.error('بڕی پارەی دراو نادروستە');
      return;
    }

    setIsSubmitting(true);
    try {
      const config = getAuthConfig();

      // Step 1: Persist any drafted products to DB before saving invoice
      const draftMap = new Map();
      for (const item of items) {
        const isDraft = item.is_draft || String(item.product_id).startsWith('draft_');
        if (isDraft && !draftMap.has(item.product_id)) {
          const draftPayload = item.draft_payload || {
            name: item.name,
            barcode: item.barcode,
            cost_price: Number(item.cost_price) || 0,
            selling_price: Number(item.selling_price) || 0,
            stock: 0,
            wholesale_price: 0,
            expiry_date: null,
            low_stock_threshold: 5,
            box_barcode: item.box_barcode || null,
            units_per_box: item.units_per_box || 1,
            is_weighted: item.is_weighted ? 1 : 0,
            unit: item.is_weighted ? 'کگم' : (item.unit || 'دانە'),
            category_id: item.category_id || null
          };
          const createRes = await axios.post('http://localhost:3001/api/products', draftPayload, config);
          const realId = createRes.data?.id || createRes.data?.data?.id;
          draftMap.set(item.product_id, realId);
        }
      }

      const payload = {
        supplier_id: supplierId,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate,
        payment_method: paymentMethod,
        additional_cost: effectiveAdditionalCost,
        total_amount: totalInvoiceCost,
        paid_amount: effectivePaid,
        remaining_amount: totalRemaining,
        items: items.map(i => {
          const isBox = i.unit_type === 'BOX';
          const unitsPerBox = Math.max(1, parseFloat(i.units_per_box) || 1);
          const totalPieces = isBox 
            ? Math.max(0.001, (parseFloat(i.box_quantity) || 0) * unitsPerBox)
            : Math.max(0.001, parseFloat(i.quantity) || 1);
          const lineTotal = getItemLineTotal(i);
          const pieceCost = isBox
            ? Math.max(0, (Number(i.box_cost_price) || 0) / unitsPerBox)
            : ((i.exact_cost_price !== undefined && i.exact_cost_price !== null)
                ? Number(i.exact_cost_price)
                : Math.max(0, Number(i.cost_price) || 0));

          const finalProductId = draftMap.has(i.product_id) ? draftMap.get(i.product_id) : i.product_id;

          return {
            product_id: finalProductId,
            quantity: Math.round(totalPieces * 1000) / 1000,
            cost_price: Math.round(pieceCost),
            purchase_price: Math.round(pieceCost),
            selling_price: Math.max(0, Number(i.selling_price) || 0),
            sell_price: Math.max(0, Number(i.selling_price) || 0),
            units_per_box: unitsPerBox,
            unit_type: i.unit_type || 'PIECE',
            box_quantity: isBox ? (parseFloat(i.box_quantity) || 1) : null,
            box_cost_price: isBox ? (Number(i.box_cost_price) || 0) : null,
            line_total: lineTotal
          };
        })
      };

      await axios.post('http://localhost:3001/api/purchase-invoices', payload, config);

      const savedSupplier = suppliers.find(s => String(s.id) === String(supplierId));
      const invoiceReceiptData = {
        invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        supplierName: savedSupplier ? savedSupplier.name : 'کڕینی نەقد',
        supplierPhone: savedSupplier ? savedSupplier.phone : '',
        date: formatDate(invoiceDate || new Date()),
        paymentMethod: paymentMethod === 'CASH' ? 'نەقد' : (paymentMethod === 'DEBT' ? 'قەرز' : 'تێکەڵ'),
        paidAmount: effectivePaid,
        remainingAmount: totalRemaining,
        itemsSubtotal,
        additionalCost: effectiveAdditionalCost,
        totalInvoiceCost,
        items: itemsWithLandedCost.map(i => {
          const lineTotal = getItemLineTotal(i);
          const unitDesc = i.unit_type === 'BOX' ? `${i.box_quantity} کارتۆن` : `${i.quantity} دانە`;

          return {
            name: i.name,
            barcode: i.barcode || '',
            quantity: unitDesc,
            cost_price: i.unit_type === 'BOX' ? Number(i.box_cost_price) : Number(i.cost_price),
            landedUnitCost: i.landedUnitCost || Number(i.cost_price) || 0,
            total: lineTotal
          };
        })
      };

      setPrintedInvoice(invoiceReceiptData);

      // If "تۆمارکردن و PDF" was clicked, trigger native Electron Save As dialog & PDF export
      if (exportPdf) {
        await handleExportPDF(invoiceReceiptData, preSelectedFileHandle);
      }

      // SILENT SUCCESS: Silently clear/reset the invoice form/table state to indicate readiness for the next invoice.
      localStorage.removeItem('pos_purchase_draft');
      setSupplierId('');
      setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
      setItems([]);
      setPaymentMethod('CASH');
      setPaidAmount('');
      setAdditionalCost('');
      setProductSearch('');

      const prodRes = await axios.get('http://localhost:3001/api/products', config);
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);

    } catch (error) {
      // EXPLICIT FAILURE (UX): Catch the API error and display it using the minimalist warning UI (No alert())
      const errorMsg = error.response?.data?.message || error.message || 'هەڵەیەکی نەزانراو لە ڕاژەکارەوە';
      setInvoiceErrorMessage(`کێشەیەک ڕوویدا، پسووڵەکە تۆمار نەکرا. هۆکار: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      maxHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '10px 16px',
      gap: '8px',
      boxSizing: 'border-box',
      direction: 'rtl'
    }}>
      
      {/* Top Section: Clean Toolbar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'nowrap',
        flexShrink: 0
      }}>
        {/* Supplier Select */}
        <div style={{ flex: '1.4', minWidth: '180px' }}>
          <select 
            value={supplierId} 
            onChange={(e) => {
              setSupplierId(e.target.value);
              if (!e.target.value) setPaymentMethod('CASH');
            }} 
            style={{
              width: '100%',
              height: '38px',
              padding: '0 10px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontSize: '0.86rem',
              outline: 'none',
              fontWeight: 700,
              boxSizing: 'border-box'
            }}
          >
            <option value="">کۆمپانیا دیاریبکە...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Invoice Number */}
        <div style={{ width: '130px' }}>
          <input 
            type="text" 
            value={invoiceNumber} 
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="ژمارەی پسووڵە"
            style={{
              width: '100%',
              height: '38px',
              padding: '0 10px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontFamily: 'monospace',
              fontSize: '0.86rem',
              textAlign: 'center',
              boxSizing: 'border-box',
              outline: 'none'
            }} 
          />
        </div>

        {/* Date Picker */}
        <div style={{ width: '140px' }}>
          <input 
            type="date" 
            lang="en-GB"
            value={invoiceDate} 
            onChange={(e) => setInvoiceDate(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 10px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontSize: '0.86rem',
              textAlign: 'center',
              boxSizing: 'border-box',
              outline: 'none'
            }} 
          />
        </div>

        {/* Payment Method Selector (Segmented 38px) */}
        <div style={{
          display: 'inline-flex',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          height: '38px',
          width: '180px',
          boxSizing: 'border-box'
        }}>
          {[
            { id: 'CASH', label: 'نەقد' },
            { id: 'DEBT', label: 'قەرز' },
            { id: 'PARTIAL', label: 'تێکەڵ' }
          ].map(pm => (
            <button
              key={pm.id}
              type="button"
              onClick={() => {
                if (pm.id !== 'CASH' && !supplierId) {
                  setCompanyWarningOpen(true);
                  return;
                }
                setPaymentMethod(pm.id);
                if (pm.id === 'PARTIAL' && (paymentMethod === 'CASH' || !paidAmount)) {
                  setPaidAmount('0');
                }
              }}
              style={{
                flex: 1,
                border: 'none',
                cursor: 'pointer',
                fontWeight: paymentMethod === pm.id ? 800 : 600,
                background: paymentMethod === pm.id ? '#2563eb' : '#f8fafc',
                color: paymentMethod === pm.id ? '#ffffff' : '#64748b',
                fontSize: '0.82rem',
                transition: 'background 0.15s ease'
              }}
            >
              {pm.label}
            </button>
          ))}
        </div>

        {/* Paid Amount Field (Only in Partial Mode - Standard 1px solid #cbd5e1 gray border) */}
        {paymentMethod === 'PARTIAL' && (
          <div style={{ width: '120px' }}>
            <input 
              type="number" 
              step="any"
              min="0"
              max={totalInvoiceCost}
              value={paidAmount} 
              onChange={(e) => handlePaidAmountChange(e.target.value)} 
              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
              placeholder="پارەی دراو"
              style={{
                width: '100%',
                height: '38px',
                padding: '0 8px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#1e293b',
                fontWeight: 700,
                fontSize: '0.88rem',
                textAlign: 'center',
                boxSizing: 'border-box',
                outline: 'none'
              }} 
            />
          </div>
        )}

        {/* Additional Cost Field */}
        <div style={{ width: '150px' }}>
          <input 
            type="number" 
            step="any"
            min="0"
            value={additionalCost} 
            onChange={(e) => {
              if (e.target.value === '') {
                setAdditionalCost('');
              } else {
                const v = Math.max(0, parseFloat(e.target.value) || 0);
                setAdditionalCost(String(v));
              }
            }}
            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
            placeholder="تێچووی زیادە (بار)"
            style={{
              width: '100%',
              height: '38px',
              padding: '0 8px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontWeight: 700,
              fontSize: '0.86rem',
              textAlign: 'center',
              boxSizing: 'border-box',
              outline: 'none'
            }} 
          />
        </div>
      </div>

      {/* Consolidate Search Row: Barcode, Name Search, Add, and + New Product on tightly unified line */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
      }}>
        {/* Barcode Scan Form */}
        <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '6px', flex: '1.2' }}>
          <input 
            ref={scanInputRef}
            type="text" 
            placeholder="سکان یان نوسینی بارکۆد..." 
            value={scanBarcode}
            onChange={(e) => setScanBarcode(normalizeBarcode(e.target.value))}
            autoFocus
            style={{
              flex: 1,
              height: '38px',
              padding: '0 10px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontSize: '0.88rem',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
          <button 
            type="submit" 
            style={{
              height: '38px',
              padding: '0 16px',
              borderRadius: '6px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
          >
            زیادکردن
          </button>
        </form>

        {/* Kurdish Live Search */}
        <div style={{ position: 'relative', flex: '1.5' }}>
          <input 
            type="text"
            placeholder="گەڕان بە ناوی کاڵا..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 10px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontSize: '0.86rem',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
          {filteredProducts.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
              zIndex: 100,
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    handleProcessBarcode(p.barcode || p.box_barcode);
                    setProductSearch('');
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>{p.name}</span>
                    {parseFloat(Number(p.units_per_box)) > 1 && (
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                        ({parseFloat(Number(p.units_per_box))} دانە لە کارتۆندا)
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#1e293b', fontWeight: 700, fontSize: '0.84rem' }}>
                    {Math.round(Number(p.cost_price || 0)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add Product Button */}
        <button
          type="button"
          onClick={() => openQuickAddModal('')}
          style={{
            height: '38px',
            padding: '0 16px',
            borderRadius: '6px',
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.84rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box'
          }}
        >
          + کاڵای نوێ
        </button>
      </div>

      {/* Items Table Container (Strict Bordered Data Grid, Zero Page Scroll) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflowY: 'auto',
        overflowX: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <colgroup>
            <col style={{ width: '3%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead style={{
            position: 'sticky',
            top: 0,
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            zIndex: 10
          }}>
            <tr style={{ height: '38px', color: '#475569', fontSize: '0.82rem', fontWeight: 700 }}>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>#</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 10px', textAlign: 'right' }}>ناوی کاڵا</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>بارکۆد</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>هەبوو</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>شێوازی کڕین</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>بڕ</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>دانە لە کارتۆنێکدا</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>نرخی کڕین</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>نرخی فرۆشتن (تاک)</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 8px', textAlign: 'center' }}>کۆی کڕین</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>کردار</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ border: '1px solid #e2e8f0', padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                  هیچ کاڵایەک لە پسووڵەکەدا نییە. بارکۆد لێبدە یان بە ناوی کاڵا بگەڕێ.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const isBox = item.unit_type === 'BOX';
                const unitsPerBox = Math.max(1, parseFloat(item.units_per_box) || 1);
                const lineTotalCost = getItemLineTotal(item);

                return (
                  <tr 
                    key={index} 
                    style={{ height: '42px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Index */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '0.80rem' }}>
                      {index + 1}
                    </td>

                    {/* Name - Ultra-Clean without pill tag */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 10px', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span>{item.name}</span>
                    </td>

                    {/* Barcode */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b', fontSize: '0.82rem' }}>
                      {isBox && item.box_barcode ? item.box_barcode : item.barcode}
                    </td>

                    {/* Current Stock (عەمباری ئێستا) */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center', color: '#475569', fontWeight: 700, fontSize: '0.84rem' }}>
                      {Number(item.stock_before || 0).toLocaleString()} {item.is_weighted ? 'کگم' : 'دانە'}
                    </td>

                    {/* Unit Selector: Carton or Piece or KG */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>
                      {item.is_weighted ? (
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb' }}>کگم</span>
                      ) : (
                        <div style={{
                          display: 'inline-flex',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '2px',
                          height: '28px',
                          boxSizing: 'border-box'
                        }}>
                          <button
                            type="button"
                            onClick={() => updateItem(index, 'unit_type', 'BOX')}
                            style={{
                              padding: '0 8px',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: isBox ? '#2563eb' : 'transparent',
                              color: isBox ? '#ffffff' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            کارتۆن
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(index, 'unit_type', 'PIECE')}
                            style={{
                              padding: '0 8px',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: !isBox ? '#2563eb' : 'transparent',
                              color: !isBox ? '#ffffff' : '#64748b',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            دانە
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Quantity Input - Clean Single Centered Input */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      <input 
                        type="number" 
                        step="any"
                        min="0.001" 
                        value={isBox ? item.box_quantity : item.quantity} 
                        onChange={(e) => updateItem(index, isBox ? 'box_quantity' : 'quantity', e.target.value)} 
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        style={{
                          width: '75px',
                          height: '28px',
                          borderRadius: '4px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          outline: 'none'
                        }} 
                      />
                    </td>

                    {/* Units per Box Input ("دانە لە کارتۆنێکدا") */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      {item.is_weighted ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>
                      ) : (
                        <input 
                          type="number" 
                          step="any"
                          min="1" 
                          disabled={!isBox}
                          value={isBox ? (item.units_per_box ?? '') : '1'} 
                          onChange={(e) => updateItem(index, 'units_per_box', e.target.value)} 
                          onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                          style={{
                            width: '75px',
                            height: '28px',
                            borderRadius: '4px',
                            background: !isBox ? '#f1f5f9' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: !isBox ? '#94a3b8' : '#1e293b',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            outline: 'none',
                            cursor: !isBox ? 'not-allowed' : 'text'
                          }} 
                        />
                      )}
                    </td>

                    {/* Cost Price Input - Clean Single Centered Input */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        value={isBox ? item.box_cost_price : item.cost_price} 
                        onChange={(e) => updateItem(index, isBox ? 'box_cost_price' : 'cost_price', e.target.value)} 
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        style={{
                          width: '95px',
                          height: '28px',
                          borderRadius: '4px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          textAlign: 'center',
                          outline: 'none'
                        }} 
                      />
                    </td>

                    {/* Selling Price (Per Piece) - Clean Gray Border */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        value={item.selling_price} 
                        onChange={(e) => updateItem(index, 'selling_price', e.target.value)} 
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        style={{
                          width: '85px',
                          height: '28px',
                          borderRadius: '4px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          textAlign: 'center',
                          outline: 'none'
                        }} 
                      />
                    </td>

                    {/* Line Total: Exactly Quantity × Purchase Price */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 8px', textAlign: 'center', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>
                      {lineTotalCost.toLocaleString()}
                    </td>

                    {/* Actions: Clean Minimalist Gray Border Button */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => removeItem(index)} 
                        style={{
                          background: '#ffffff',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.background = '#fef2f2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#64748b';
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        سڕینەوە
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Sticky Summary & Save Bar: Clean Solid White Background, subtle top border, standard font weights */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderTop: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0
      }}>
        {/* Summary Indicators with Clean Monochrome Text (No 5 rainbow colors) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', color: '#475569', fontSize: '0.86rem' }}>
          <div>
            کاڵا: <strong style={{ color: '#1e293b', fontWeight: 800 }}>{items.length} جۆر ({totalQty} دانە)</strong>
          </div>

          <div>
            کۆی کڕین: <strong style={{ color: '#1e293b', fontWeight: 800 }}>{itemsSubtotal.toLocaleString()} د.ع</strong>
          </div>

          {effectiveAdditionalCost > 0 && (
            <div>
              تێچووی زیادە: <strong style={{ color: '#1e293b', fontWeight: 800 }}>{effectiveAdditionalCost.toLocaleString()} د.ع</strong>
            </div>
          )}

          <div>
            کۆی گشتی: <strong style={{ color: '#1e293b', fontWeight: 800 }}>{totalInvoiceCost.toLocaleString()} د.ع</strong>
          </div>

          <div>
            دراو: <strong style={{ color: '#1e293b', fontWeight: 800 }}>{effectivePaid.toLocaleString()} د.ع</strong>
          </div>

          <div>
            ماوە (قەرز): <strong style={{ color: '#1e293b', fontWeight: 800 }}>{totalRemaining.toLocaleString()} د.ع</strong>
          </div>
        </div>

        {/* Action Save & Print Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {printedInvoice && (
            <button
              type="button"
              onClick={() => handleExportPDF(printedInvoice)}
              style={{
                height: '36px',
                padding: '0 12px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0284c7',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              دەرکردنی فایلی PDF
            </button>
          )}

          <button 
            type="button"
            onClick={() => handleSaveInvoice(false)}
            disabled={isSaveDisabled}
            style={{
              height: '36px',
              padding: '0 18px',
              borderRadius: '6px',
              background: isSaveDisabled ? '#f8fafc' : '#ffffff',
              color: isSaveDisabled ? '#94a3b8' : '#1e293b',
              border: isSaveDisabled ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            تۆمارکردن
          </button>

          <button 
            type="button"
            onClick={onSaveAndPdf}
            disabled={isSaveDisabled}
            style={{
              height: '36px',
              padding: '0 20px',
              borderRadius: '6px',
              background: isSaveDisabled ? '#cbd5e1' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 800,
              cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
              boxShadow: isSaveDisabled ? 'none' : '0 2px 6px rgba(37,99,235,0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            تۆمارکردن و PDF
          </button>
        </div>
      </div>

      {/* Quick Add Product Modal (Unified DRY Layout matching Products & Warehouse) */}
      <ProductModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={handleQuickAddSuccess}
        mode="purchase"
        presetBarcode={quickAddBarcode}
        categories={categories}
        onCategoriesUpdate={(newCat) => {
          setCategories(prev => {
            if (prev.some(x => x.id === newCat.id)) return prev;
            return [...prev, newCat];
          });
        }}
        title="تۆمارکردنی کاڵای نوێ بۆ کۆگا"
        submitText="زیادکردن"
      />

      {/* Hidden Thermal Purchase Receipt (Targeted by @media print) */}
      <style>{`
        #thermal-purchase-receipt {
          display: none !important;
        }
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-purchase-receipt, #thermal-purchase-receipt * {
            visibility: visible !important;
          }
          #thermal-purchase-receipt {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            background: white !important;
            color: black !important;
            padding: 8px 10px !important;
            font-family: monospace, Tahoma, 'Noto Kufi Arabic', sans-serif !important;
            font-size: 13px !important;
            direction: rtl !important;
            text-align: right !important;
          }
          .purchase-divider {
            border-bottom: 1px dashed #000 !important;
            margin: 6px 0 !important;
          }
        }
      `}</style>

      {printedInvoice && (
        <div id="thermal-purchase-receipt" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
          {storePhone && <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>}
          <div className="purchase-divider"></div>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>وەسڵی کڕینی کاڵا</div>
          <div className="purchase-divider"></div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ژمارەی وەسڵ:</span>
            <span style={{ fontWeight: 'bold', direction: 'ltr' }}>{printedInvoice.invoiceNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>کۆمپانیا:</span>
            <span style={{ fontWeight: 'bold' }}>{printedInvoice.supplierName}</span>
          </div>
          {printedInvoice.supplierPhone && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>مۆبایل:</span>
              <span style={{ direction: 'ltr' }}>{printedInvoice.supplierPhone}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>بەروار:</span>
            <span>{printedInvoice.date}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>شێوازی پارەدان:</span>
            <span style={{ fontWeight: 'bold' }}>{printedInvoice.paymentMethod}</span>
          </div>

          <div className="purchase-divider"></div>

          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '4px 0' }}>کاڵا</th>
                <th style={{ padding: '4px 0', textAlign: 'center' }}>بڕ</th>
                <th style={{ padding: '4px 0', textAlign: 'left' }}>کۆ</th>
              </tr>
            </thead>
            <tbody>
              {printedInvoice.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '4px 0' }}>{item.name}</td>
                  <td style={{ padding: '4px 0', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '4px 0', textAlign: 'left' }}>{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="purchase-divider"></div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>کۆی کاڵاکان:</span>
            <span>{printedInvoice.itemsSubtotal.toLocaleString()} د.ع</span>
          </div>
          {printedInvoice.additionalCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>تێچووی زیادە:</span>
              <span>{printedInvoice.additionalCost.toLocaleString()} د.ع</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
            <span>کۆی گشتی:</span>
            <span>{printedInvoice.totalInvoiceCost.toLocaleString()} د.ع</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>پارەی دراو:</span>
            <span>{printedInvoice.paidAmount.toLocaleString()} د.ع</span>
          </div>
          {printedInvoice.remainingAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>قەرزی ماوە:</span>
              <span>{printedInvoice.remainingAmount.toLocaleString()} د.ع</span>
            </div>
          )}

          <div className="purchase-divider"></div>
          <p style={{ textAlign: 'center', marginTop: '6px', fontSize: '9px' }}>وەسڵی فەرمیی کڕین</p>
        </div>
      )}

      {/* Clean & Minimalist Company Required Notification Modal */}
      {companyWarningOpen && (
        <div 
          onClick={() => setCompanyWarningOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            direction: 'rtl'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              padding: '24px 32px',
              width: '320px',
              maxWidth: '90vw',
              textAlign: 'center',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <p style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: '#1e293b',
              lineHeight: 1.5
            }}>
              تکایە سەرەتا کۆمپانیا دیاری بکە
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setCompanyWarningOpen(false)}
              style={{
                height: '36px',
                padding: '0 32px',
                borderRadius: '6px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer'
              }}
            >
              باشە
            </button>
          </div>
        </div>
      )}

      {/* Clean & Minimalist Explicit Failure Modal */}
      {invoiceErrorMessage && (
        <div 
          onClick={() => setInvoiceErrorMessage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            direction: 'rtl'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              padding: '24px 32px',
              width: '380px',
              maxWidth: '90vw',
              textAlign: 'center',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <p style={{
              margin: 0,
              fontSize: '0.96rem',
              fontWeight: 700,
              color: '#dc2626',
              lineHeight: 1.6
            }}>
              {invoiceErrorMessage}
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setInvoiceErrorMessage(null)}
              style={{
                height: '36px',
                padding: '0 32px',
                borderRadius: '6px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer'
              }}
            >
              باشە
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Purchases;
