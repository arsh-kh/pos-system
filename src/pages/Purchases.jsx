import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

const formatCleanQty = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const num = parseFloat(val);
  if (isNaN(num)) return String(val);
  if (Number.isInteger(num)) return String(num);
  return String(parseFloat(num.toFixed(3)));
};

const Purchases = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editInvoiceId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('edit');
  }, [location.search]);

  const [isEditMode, setIsEditMode] = useState(false);
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

  // Dedicated Gifts (دیارییەکان) State
  const [giftsList, setGiftsList] = useState(() => {
    if (Array.isArray(initialDraft.giftsList)) return initialDraft.giftsList;
    if (initialDraft.giftData) return [initialDraft.giftData];
    return [];
  });
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftProductSearch, setGiftProductSearch] = useState('');
  const [selectedGiftProduct, setSelectedGiftProduct] = useState(null);
  const [giftUnitType, setGiftUnitType] = useState('BOX');
  const [giftQuantity, setGiftQuantity] = useState('1');
  const [giftValue, setGiftValue] = useState('');
  const [giftAllocationMode, setGiftAllocationMode] = useState('ALL');
  const [giftTargetKeys, setGiftTargetKeys] = useState([]);

  // Invoice Items State
  const [items, setItems] = useState(() => Array.isArray(initialDraft.items) ? initialDraft.items : []);

  // Barcode Scanner & Search State
  const [scanBarcode, setScanBarcode] = useState('');
  const scanInputRef = useRef(null);
  const [productSearch, setProductSearch] = useState('');
  const [highlightedRowIndex, setHighlightedRowIndex] = useState(null);

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

  const giftFilteredProducts = useMemo(() => {
    if (!giftProductSearch.trim() || selectedGiftProduct) return [];
    return products.filter(p => kurdishSearchMatch([p.name, p.barcode, p.box_barcode], giftProductSearch)).slice(0, 10);
  }, [products, giftProductSearch, selectedGiftProduct]);

  const cleanNumericInput = (val) => {
    if (val === '' || val === undefined || val === null) return '';
    const str = String(val);
    const sanitized = str.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
  };

  const placeCursorAtEnd = (e) => {
    const el = e.target;
    if (!el) return;
    const setEnd = () => {
      try {
        const len = el.value ? el.value.length : 0;
        if (typeof el.setSelectionRange === 'function') {
          el.setSelectionRange(len, len);
        }
      } catch (_) {}
    };
    setEnd();
    requestAnimationFrame(setEnd);
    setTimeout(setEnd, 0);
    setTimeout(setEnd, 20);
  };

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchData = async () => {
    const config = getAuthConfig();
    try {
      const supRes = await axios.get('http://localhost:3001/api/suppliers');
      if (supRes.data?.status === 'SUCCESS') setSuppliers(supRes.data.data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }

    try {
      const prodRes = await axios.get('http://localhost:3001/api/products', config);
      if (prodRes.data?.status === 'SUCCESS') setProducts(prodRes.data.data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }

    try {
      const catRes = await axios.get('http://localhost:3001/api/categories', config);
      if (catRes.data?.status === 'SUCCESS') setCategories(catRes.data.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }

    // Auto-clean draft if this invoice number has already been successfully committed in DB
    try {
      const currentDraft = getInitialDraft();
      if (currentDraft && currentDraft.invoiceNumber && !editInvoiceId) {
        const invCheck = await axios.get('http://localhost:3001/api/purchase-invoices', config);
        const alreadySaved = invCheck.data?.data?.some(inv => inv.invoice_number === currentDraft.invoiceNumber);
        if (alreadySaved) {
          localStorage.removeItem('pos_purchase_draft');
          setSupplierId('');
          setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
          setItems([]);
          setPaymentMethod('CASH');
          setPaidAmount('');
          setAdditionalCost('');
          setGiftsList([]);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Edit Mode: Fetch invoice details when edit parameter is present
  useEffect(() => {
    if (!editInvoiceId) {
      setIsEditMode(false);
      return;
    }

    const fetchInvoiceForEdit = async () => {
      try {
        const config = getAuthConfig();
        const res = await axios.get(`http://localhost:3001/api/purchase-invoices/${editInvoiceId}`, config);
        if (res.data?.status === 'SUCCESS' && res.data.data) {
          const inv = res.data.data;
          setIsEditMode(true);
          setSupplierId(String(inv.supplier_id || ''));
          setInvoiceNumber(inv.invoice_number || `INV-${inv.id}`);
          const rawDate = inv.created_at || '';
          setInvoiceDate(rawDate.includes('T') ? rawDate.split('T')[0] : (rawDate.split(' ')[0] || new Date().toISOString().split('T')[0]));
          setPaymentMethod(inv.payment_method || 'CASH');
          setPaidAmount(String(inv.paid_amount || ''));
          setAdditionalCost(String(inv.additional_cost || '0'));

          let parsedGifts = [];
          if (inv.gift_data) {
            try {
              parsedGifts = typeof inv.gift_data === 'string' ? JSON.parse(inv.gift_data) : inv.gift_data;
              if (!Array.isArray(parsedGifts)) parsedGifts = [parsedGifts];
            } catch (_) {
              parsedGifts = [];
            }
          }

          if (parsedGifts.length === 0 && Array.isArray(inv.items)) {
            const legacyGiftItems = inv.items.filter(it => it.is_gift === 1 || it.is_gift === true);
            parsedGifts = legacyGiftItems.map((giftIt, gIdx) => {
              const isGiftBox = giftIt.unit_type === 'BOX';
              const gUnits = Math.max(1, parseFloat(giftIt.units_per_box) || 1);
              const gBoxCost = giftIt.box_cost_price ? Number(giftIt.box_cost_price) : Math.round(Number(giftIt.cost_price || 0) * gUnits);
              const gQty = isGiftBox && giftIt.box_quantity ? giftIt.box_quantity : (isGiftBox ? (Number(giftIt.quantity) / gUnits) : giftIt.quantity);
              const gVal = isGiftBox ? (Number(gQty) * gBoxCost) : (Number(gQty) * Number(giftIt.cost_price || 0));

              return {
                id: 'gift_legacy_' + gIdx,
                product_id: giftIt.product_id,
                name: giftIt.product_name,
                barcode: giftIt.barcode,
                box_barcode: giftIt.box_barcode || '',
                unit_type: giftIt.unit_type || 'BOX',
                quantity: String(gQty || '1'),
                units_per_box: gUnits,
                cost_price: Number(giftIt.cost_price) || 0,
                box_cost_price: gBoxCost,
                selling_price: giftIt.selling_price || 0,
                gift_value: String(gVal || gBoxCost),
                allocation_mode: 'ALL',
                target_keys: []
              };
            });
          }

          setGiftsList(parsedGifts);

            const regularItems = inv.items.filter(it => !it.is_gift);
            const loadedItems = regularItems.map(it => {
              const unitsPerBox = Math.max(1, parseFloat(it.units_per_box) || 1);
              const isBox = it.unit_type === 'BOX';
              const costPrice = Number(it.cost_price) || 0;
              const boxCostPrice = it.box_cost_price ? Number(it.box_cost_price) : Math.round(costPrice * unitsPerBox);

              const rawBoxQty = it.box_quantity !== undefined && it.box_quantity !== null && it.box_quantity !== ''
                ? it.box_quantity
                : (unitsPerBox > 0 ? (Number(it.quantity) / unitsPerBox) : 1);
              const cleanBoxQty = formatCleanQty(rawBoxQty);

              const cleanQty = formatCleanQty(it.quantity || 0);
              const cleanBonusQty = it.bonus_quantity !== undefined && it.bonus_quantity !== null && Number(it.bonus_quantity) > 0
                ? formatCleanQty(it.bonus_quantity)
                : '';

              return {
                product_id: it.product_id,
                name: it.product_name,
                barcode: it.barcode,
                box_barcode: it.box_barcode || '',
                units_per_box: unitsPerBox,
                unit_type: it.unit_type || 'PIECE',
                box_quantity: cleanBoxQty,
                box_cost_price: String(boxCostPrice),
                quantity: cleanQty,
                bonus_quantity: cleanBonusQty,
                cost_price: String(costPrice),
                selling_price: it.selling_price || 0,
                stock_before: it.current_stock || 0,
                is_weighted: Boolean(it.is_weighted),
                unit: it.unit || 'دانە',
                original_quantity: it.quantity,
                original_item_id: it.id
              };
            });
            setItems(loadedItems);
        }
      } catch (err) {
        console.error('Error fetching invoice for edit:', err);
        toast.error('هەڵەیەک ڕوویدا لە بارکردنی پسووڵەکە');
      }
    };

    fetchInvoiceForEdit();
  }, [editInvoiceId]);

  const handleCancelEdit = () => {
    localStorage.removeItem('pos_purchase_draft');
    setSupplierId('');
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setItems([]);
    setPaymentMethod('CASH');
    setPaidAmount('');
    setAdditionalCost('');
    setGiftsList([]);
    setIsEditMode(false);
    navigate('/financials');
  };


  // Auto-sync draft to localStorage (Disabled during Edit Mode)
  useEffect(() => {
    if (isEditMode) return;
    if (items.length > 0 || supplierId) {
      try {
        localStorage.setItem('pos_purchase_draft', JSON.stringify({
          supplierId,
          invoiceNumber,
          invoiceDate,
          paymentMethod,
          paidAmount,
          additionalCost,
          items,
          giftsList
        }));
      } catch (err) {
        console.error('Failed to save purchase draft:', err);
      }
    } else {
      localStorage.removeItem('pos_purchase_draft');
    }
  }, [supplierId, invoiceNumber, invoiceDate, paymentMethod, paidAmount, additionalCost, items, giftsList]);

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
      const unitsPerBox = existing.units_per_box ? Math.max(1, parseFloat(existing.units_per_box) || 1) : 1;
      const isScannedBox = Boolean(existing.box_barcode && normalizeBarcode(existing.box_barcode) === cleanCode);
      const initialUnitType = isScannedBox ? 'BOX' : (unitsPerBox > 1 ? 'BOX' : 'PIECE');

      setItems(prevItems => {
        const itemIdx = prevItems.findIndex(i => i.product_id === existing.id);
        if (itemIdx >= 0) {
          setHighlightedRowIndex(itemIdx);
          setTimeout(() => setHighlightedRowIndex(null), 3000);
          toast.warning(`کاڵای «${existing.name}» پێشتر لە لیستەکەدا هەیە. دەتوانیت بڕەکەی لە خشتەکەدا دەستکاری بکەیت.`);
          setTimeout(() => {
            const el = document.getElementById(`purchase-row-${itemIdx}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);
          return prevItems;
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
              bonus_quantity: '',
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
    if (isQuickAddOpen) return;
    handleProcessBarcode(scannedCode);
  });

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (isQuickAddOpen) return;
    if (scanBarcode) {
      handleProcessBarcode(scanBarcode);
    }
  };

  const handleQuickAddSuccess = (newProd) => {
    const isWeighted = Boolean(newProd.is_weighted || newProd.unit === 'کگم');
    const unitsPerBox = newProd.units_per_box ? Math.max(1, parseFloat(newProd.units_per_box) || 1) : 1;
    const boxCost = Math.max(0, Number(newProd.box_cost_price) || (Number(newProd.cost_price) * unitsPerBox) || 0);
    const pieceCost = Math.max(0, Number(newProd.cost_price) || 0);
    const initialUnitType = (unitsPerBox > 1) ? 'BOX' : 'PIECE';

    let initialQty = '1';
    if (newProd.initial_qty !== null && newProd.initial_qty !== undefined && !isNaN(Number(newProd.initial_qty)) && Number(newProd.initial_qty) > 0) {
      initialQty = String(newProd.initial_qty);
    } else if (initialUnitType === 'BOX') {
      initialQty = String(unitsPerBox);
    }

    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.product_id === newProd.id);
      if (existingIdx >= 0) {
        setHighlightedRowIndex(existingIdx);
        setTimeout(() => setHighlightedRowIndex(null), 3000);
        toast.warning(`کاڵای «${newProd.name}» پێشتر لە پسووڵەکەدا هەیە.`);
        setTimeout(() => {
          const el = document.getElementById(`purchase-row-${existingIdx}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        return prev;
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
          bonus_quantity: '',
          cost_price: String(effectivePieceCost),
          selling_price: newProd.selling_price || 0,
          stock_before: 0,
          is_draft: Boolean(newProd.is_draft),
          draft_payload: newProd.is_draft ? newProd : null,
          category_id: newProd.category_id || null,
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

          if (it.bonus_quantity !== '' && it.bonus_quantity !== undefined && it.bonus_quantity !== null) {
            const bNum = parseFloat(it.bonus_quantity) || 0;
            it.bonus_quantity = bNum > 0 ? String(parseFloat((bNum / currentMult).toFixed(2)) || 0) : '';
          }

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

          if (it.bonus_quantity !== '' && it.bonus_quantity !== undefined && it.bonus_quantity !== null) {
            const bNum = parseFloat(it.bonus_quantity) || 0;
            it.bonus_quantity = bNum > 0 ? String(Math.round(bNum * currentMult)) : '';
          }

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
            it.quantity = it.is_weighted ? String(parseFloat((safeVal * mult).toFixed(3))) : String(Math.round(safeVal * mult));
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
      } else if (field === 'bonus_quantity') {
        if (value === '') {
          it.bonus_quantity = '';
        } else {
          const parsed = parseFloat(value);
          if (parsed < 0 || isNaN(parsed)) {
            it.bonus_quantity = '0';
          } else {
            it.bonus_quantity = value;
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

  // Dedicated Gift (دیاری) Modal Handlers & Helpers
  const getGiftTargetSummary = (gift) => {
    if (gift.allocation_mode !== 'SELECTED' || !Array.isArray(gift.target_keys) || gift.target_keys.length === 0) {
      return 'گشت کاڵاکان';
    }
    const targetNames = gift.target_keys.map(k => {
      const matched = items.find(it => (it.barcode || it.name) === k);
      return matched ? matched.name : k;
    });
    if (targetNames.length === 1) return targetNames[0];
    if (targetNames.length === 2) return `${targetNames[0]}، ${targetNames[1]}`;
    return `${targetNames[0]} و ${targetNames.length - 1} کاڵای تر`;
  };

  const openGiftModal = () => {
    setSelectedGiftProduct(null);
    setGiftProductSearch('');
    setGiftUnitType('BOX');
    setGiftQuantity('1');
    setGiftValue('');
    setGiftAllocationMode('ALL');
    setGiftTargetKeys(items.map((it, idx) => it.barcode || it.name || String(idx)));
    setGiftModalOpen(true);
  };

  const handleSelectGiftProduct = (prod) => {
    setSelectedGiftProduct(prod);
    setGiftProductSearch(prod.name);
    const units = Math.max(1, parseFloat(prod.units_per_box) || 1);
    const isBox = units > 1 || Boolean(prod.box_barcode) || Boolean(prod.box_cost_price);
    const unitType = isBox ? 'BOX' : 'PIECE';
    setGiftUnitType(unitType);

    const bCost = prod.box_cost_price ? Number(prod.box_cost_price) : Math.round(Number(prod.cost_price || 0) * units);
    const pCost = Number(prod.cost_price || 0);
    const q = Math.max(0.001, parseFloat(giftQuantity) || 1);
    const val = unitType === 'BOX' ? Math.round(q * bCost) : Math.round(q * pCost);
    setGiftValue(String(val || bCost || pCost || '0'));
  };

  const handleGiftUnitTypeChange = (type) => {
    setGiftUnitType(type);
    if (selectedGiftProduct) {
      const units = Math.max(1, parseFloat(selectedGiftProduct.units_per_box) || 1);
      const bCost = selectedGiftProduct.box_cost_price 
        ? Number(selectedGiftProduct.box_cost_price) 
        : Math.round(Number(selectedGiftProduct.cost_price || 0) * units);
      const pCost = Number(selectedGiftProduct.cost_price || 0);
      const q = Math.max(0.001, parseFloat(giftQuantity) || 1);
      const val = type === 'BOX' ? Math.round(q * bCost) : Math.round(q * pCost);
      setGiftValue(String(val || '0'));
    }
  };

  const handleGiftQuantityChange = (newQty) => {
    setGiftQuantity(newQty);
    const q = Math.max(0, parseFloat(newQty) || 0);
    if (selectedGiftProduct && q > 0) {
      const units = Math.max(1, parseFloat(selectedGiftProduct.units_per_box) || 1);
      const bCost = selectedGiftProduct.box_cost_price 
        ? Number(selectedGiftProduct.box_cost_price) 
        : Math.round(Number(selectedGiftProduct.cost_price || 0) * units);
      const pCost = Number(selectedGiftProduct.cost_price || 0);
      const val = giftUnitType === 'BOX' ? Math.round(q * bCost) : Math.round(q * pCost);
      setGiftValue(String(val || '0'));
    }
  };

  const handleAddGiftToList = () => {
    if (!selectedGiftProduct) {
      toast.error('تکایە کاڵای دیاری هەڵبژێرە');
      return;
    }
    const q = parseFloat(giftQuantity);
    if (!q || q <= 0) {
      toast.error('تکایە بڕی دیاری دیاری بکە');
      return;
    }
    const val = parseFloat(giftValue);
    if (val === undefined || isNaN(val) || val < 0) {
      toast.error('تکایە بەهای دیاری دیاری بکە');
      return;
    }

    if (giftAllocationMode === 'SELECTED' && (!giftTargetKeys || giftTargetKeys.length === 0)) {
      toast.error('تکایە لانیکەم یەک کاڵا دیاری بکە بۆ داشکاندنەکە');
      return;
    }

    const units = Math.max(1, parseFloat(selectedGiftProduct.units_per_box) || 1);
    const bCost = selectedGiftProduct.box_cost_price 
      ? Number(selectedGiftProduct.box_cost_price) 
      : Math.round(Number(selectedGiftProduct.cost_price || 0) * units);
    const pCost = Number(selectedGiftProduct.cost_price || 0);

    const newGift = {
      id: 'gift_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      product_id: selectedGiftProduct.id,
      name: selectedGiftProduct.name,
      barcode: selectedGiftProduct.barcode,
      box_barcode: selectedGiftProduct.box_barcode || '',
      unit_type: giftUnitType,
      quantity: String(q),
      units_per_box: units,
      cost_price: pCost,
      box_cost_price: bCost,
      selling_price: selectedGiftProduct.selling_price || 0,
      gift_value: String(val),
      allocation_mode: giftAllocationMode,
      target_keys: giftAllocationMode === 'SELECTED' ? [...giftTargetKeys] : []
    };

    setGiftsList(prev => [...prev, newGift]);
    setSelectedGiftProduct(null);
    setGiftProductSearch('');
    setGiftQuantity('1');
    setGiftValue('');
    setGiftAllocationMode('ALL');
    setGiftTargetKeys(items.map((it, idx) => it.barcode || it.name || String(idx)));
    toast.success('دیارییەکە زیادکرا بۆ لیستەکە');
  };

  const handleRemoveGiftFromList = (giftId) => {
    setGiftsList(prev => prev.filter(g => g.id !== giftId));
    toast.success('دیارییەکە سڕایەوە');
  };

  const handleSaveGiftModal = () => {
    if (selectedGiftProduct && parseFloat(giftQuantity) > 0 && parseFloat(giftValue) >= 0) {
      if (giftAllocationMode !== 'SELECTED' || (giftTargetKeys && giftTargetKeys.length > 0)) {
        const units = Math.max(1, parseFloat(selectedGiftProduct.units_per_box) || 1);
        const bCost = selectedGiftProduct.box_cost_price 
          ? Number(selectedGiftProduct.box_cost_price) 
          : Math.round(Number(selectedGiftProduct.cost_price || 0) * units);
        const pCost = Number(selectedGiftProduct.cost_price || 0);
        const q = parseFloat(giftQuantity) || 1;
        const val = parseFloat(giftValue) || 0;

        const newGift = {
          id: 'gift_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          product_id: selectedGiftProduct.id,
          name: selectedGiftProduct.name,
          barcode: selectedGiftProduct.barcode,
          box_barcode: selectedGiftProduct.box_barcode || '',
          unit_type: giftUnitType,
          quantity: String(q),
          units_per_box: units,
          cost_price: pCost,
          box_cost_price: bCost,
          selling_price: selectedGiftProduct.selling_price || 0,
          gift_value: String(val),
          allocation_mode: giftAllocationMode,
          target_keys: giftAllocationMode === 'SELECTED' ? [...giftTargetKeys] : []
        };
        setGiftsList(prev => [...prev, newGift]);
      }
    }
    setGiftModalOpen(false);
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

  // Total Gifts Value across all active gifts
  const totalGiftsValue = useMemo(() => {
    return giftsList.reduce((sum, g) => sum + (Math.max(0, Number(g.gift_value) || 0)), 0);
  }, [giftsList]);

  // Calculations: Subtotal, Shipping, Grand Total, Landed Cost Allocation & Multi-Gift Discount Allocation
  const { 
    itemsSubtotal, 
    effectiveAdditionalCost, 
    totalInvoiceCost, 
    totalSalesValue, 
    totalProfit, 
    totalQty,
    itemsWithLandedCost,
    totalGiftsDiscount
  } = useMemo(() => {
    let cost = 0;
    let sales = 0;
    let qtySum = 0;

    items.forEach(item => {
      const q = Math.max(0, parseFloat(item.quantity) || 0);
      const isBox = item.unit_type === 'BOX';
      const unitsPerBox = Math.max(1, parseFloat(item.units_per_box) || 1);
      const bonusQty = Math.max(0, parseFloat(item.bonus_quantity) || 0);
      const bonusPieces = isBox ? (bonusQty * unitsPerBox) : bonusQty;
      const totalPieces = q + bonusPieces;

      const sp = Math.max(0, Number(item.selling_price) || 0);
      const lineCost = getItemLineTotal(item);

      cost += lineCost;
      sales += sp * totalPieces;
      qtySum += totalPieces;
    });

    // 2. Multi-Gift Discount Allocation across target items
    const itemDiscounts = new Array(items.length).fill(0);

    giftsList.forEach(gift => {
      const gVal = Math.max(0, Number(gift.gift_value) || 0);
      if (gVal <= 0) return;

      const isAll = gift.allocation_mode !== 'SELECTED' || !Array.isArray(gift.target_keys) || gift.target_keys.length === 0;

      const targetIndices = [];
      let totalTargetCost = 0;

      items.forEach((item, idx) => {
        const itemKey = item.barcode || item.name || String(idx);
        const isTarget = isAll || (gift.target_keys && gift.target_keys.includes(itemKey));
        const lineCost = getItemLineTotal(item);
        if (isTarget && lineCost > 0) {
          targetIndices.push(idx);
          totalTargetCost += lineCost;
        }
      });

      if (totalTargetCost > 0) {
        const effectiveGiftDiscount = Math.min(gVal, totalTargetCost);
        let remainingGiftDiscount = effectiveGiftDiscount;

        targetIndices.forEach((idx, tPos) => {
          const item = items[idx];
          const lineCost = getItemLineTotal(item);
          let share = 0;
          if (tPos === targetIndices.length - 1) {
            share = remainingGiftDiscount;
          } else {
            share = Math.round((lineCost / totalTargetCost) * effectiveGiftDiscount);
            remainingGiftDiscount -= share;
          }
          itemDiscounts[idx] += share;
        });
      }
    });

    const itemsWithDiscount = items.map((item, idx) => {
      const lineCost = getItemLineTotal(item);
      const allocatedDiscount = Math.min(itemDiscounts[idx], lineCost);
      const netLineCost = Math.max(0, lineCost - allocatedDiscount);

      const isBox = item.unit_type === 'BOX';
      const unitsPerBox = Math.max(1, parseFloat(item.units_per_box) || 1);
      const boxQty = Math.max(0.001, parseFloat(item.box_quantity) || 1);
      const pieceQty = Math.max(0.001, parseFloat(item.quantity) || 1);

      const discountedBoxCost = Math.round(netLineCost / boxQty);
      const discountedPieceCost = isBox 
        ? Math.round(discountedBoxCost / unitsPerBox) 
        : Math.round(netLineCost / pieceQty);

      return {
        ...item,
        allocatedDiscount,
        netLineCost,
        discountedBoxCost,
        discountedPieceCost,
        itemKey: item.barcode || item.name || String(idx)
      };
    });

    // 3. Additional Cost (Freight) Allocation
    const addCost = Math.max(0, Math.round(Number(additionalCost) || 0));
    const giftsDiscountSum = itemsWithDiscount.reduce((sum, i) => sum + (i.allocatedDiscount || 0), 0);
    const grandTotal = Math.max(0, cost - giftsDiscountSum) + addCost;

    let remainingAdd = addCost;
    const itemsWithLanded = itemsWithDiscount.map((item, idx) => {
      const isBox = item.unit_type === 'BOX';
      const unitsPerBox = Math.max(1, parseFloat(item.units_per_box) || 1);
      const totalPieces = isBox
        ? Math.max(0.001, (parseFloat(item.box_quantity) || 0) * unitsPerBox)
        : Math.max(0.001, parseFloat(item.quantity) || 1);
      const lineCost = getItemLineTotal(item);

      let allocatedAdd = 0;
      if (addCost > 0 && cost > 0) {
        if (idx === itemsWithDiscount.length - 1) {
          allocatedAdd = remainingAdd;
        } else {
          allocatedAdd = Math.round((addCost * lineCost) / cost);
          remainingAdd -= allocatedAdd;
        }
      }

      const totalLineOutlay = item.netLineCost + allocatedAdd;
      const landedUnitCost = Math.max(0, Math.round(totalLineOutlay / totalPieces));

      return {
        ...item,
        allocatedCost: allocatedAdd,
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
      itemsWithLandedCost: itemsWithLanded,
      totalGiftsDiscount: giftsDiscountSum
    };
  }, [items, additionalCost, giftsList]);

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

      // Backend handles draft product creation and auto-deduplication atomically inside the SQL transaction
      const payload = {
        supplier_id: supplierId,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate,
        payment_method: paymentMethod,
        additional_cost: effectiveAdditionalCost,
        total_amount: totalInvoiceCost,
        paid_amount: effectivePaid,
        remaining_amount: totalRemaining,
        items: itemsWithLandedCost.map(i => {
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

          // Pre-resolve product_id from existing products if available
          let finalProductId = i.product_id;
          const isDraft = i.is_draft || (finalProductId && String(finalProductId).startsWith('draft_')) || !finalProductId;
          if (isDraft && Array.isArray(products)) {
            const existing = products.find(p => 
              (i.barcode && p.barcode === i.barcode) ||
              (i.box_barcode && p.box_barcode === i.box_barcode)
            );
            if (existing) finalProductId = existing.id;
          }

          return {
            product_id: finalProductId,
            name: i.name,
            barcode: i.barcode,
            box_barcode: i.box_barcode,
            is_draft: isDraft,
            category_id: i.category_id || null,
            expiry_date: i.expiry_date || null,
            unit: i.unit || 'دانە',
            is_weighted: Boolean(i.is_weighted),
            quantity: Math.round(totalPieces * 1000) / 1000,
            bonus_quantity: 0,
            discount_amount: i.allocatedDiscount || 0,
            cost_price: Math.round(pieceCost),
            purchase_price: Math.round(pieceCost),
            landed_cost_price: i.landedUnitCost || Math.round(pieceCost),
            selling_price: Math.max(0, Number(i.selling_price) || 0),
            sell_price: Math.max(0, Number(i.selling_price) || 0),
            units_per_box: unitsPerBox,
            unit_type: i.unit_type || 'PIECE',
            box_quantity: isBox ? (parseFloat(i.box_quantity) || 1) : null,
            box_cost_price: isBox ? (Number(i.box_cost_price) || 0) : null,
            line_total: lineTotal
          };
        }),
        gift_items: giftsList.map(g => ({
          product_id: g.product_id,
          name: g.name,
          barcode: g.barcode,
          box_barcode: g.box_barcode,
          unit_type: g.unit_type,
          box_quantity: g.unit_type === 'BOX' ? parseFloat(g.quantity) : null,
          units_per_box: g.units_per_box,
          quantity: g.unit_type === 'BOX' ? (parseFloat(g.quantity) * g.units_per_box) : parseFloat(g.quantity),
          cost_price: g.cost_price,
          box_cost_price: g.box_cost_price,
          selling_price: g.selling_price,
          gift_value: g.gift_value,
          allocation_mode: g.allocation_mode,
          target_keys: g.target_keys
        })),
        gift_item: giftsList.length > 0 ? {
          product_id: giftsList[0].product_id,
          name: giftsList[0].name,
          barcode: giftsList[0].barcode,
          box_barcode: giftsList[0].box_barcode,
          unit_type: giftsList[0].unit_type,
          box_quantity: giftsList[0].unit_type === 'BOX' ? parseFloat(giftsList[0].quantity) : null,
          units_per_box: giftsList[0].units_per_box,
          quantity: giftsList[0].unit_type === 'BOX' ? (parseFloat(giftsList[0].quantity) * giftsList[0].units_per_box) : parseFloat(giftsList[0].quantity),
          cost_price: giftsList[0].cost_price,
          box_cost_price: giftsList[0].box_cost_price,
          selling_price: giftsList[0].selling_price,
          gift_value: giftsList[0].gift_value,
          allocation_mode: giftsList[0].allocation_mode,
          target_keys: giftsList[0].target_keys
        } : null
      };

      if (isEditMode) {
        await axios.put(`http://localhost:3001/api/purchase-invoices/${editInvoiceId}`, payload, config);
        toast.success('پسووڵەکە بە سەرکەوتوویی نوێکرایەوە');
      } else {
        await axios.post('http://localhost:3001/api/purchase-invoices', payload, config);
      }

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
        gifts: giftsList.map(g => ({
          name: g.name,
          quantity: `${g.quantity} ${g.unit_type === 'BOX' ? 'کارتۆن' : 'دانە'}`,
          value: Number(g.gift_value)
        })),
        items: itemsWithLandedCost.map(i => {
          const lineTotal = getItemLineTotal(i);
          const unitDesc = (i.unit_type === 'BOX' ? `${i.box_quantity} ${i.is_weighted ? 'گونیە' : 'کارتۆن'}` : `${i.quantity} ${i.is_weighted ? 'کگم' : 'دانە'}`);

          return {
            name: i.name,
            barcode: i.barcode || '',
            quantity: unitDesc,
            cost_price: i.unit_type === 'BOX' ? Number(i.box_cost_price) : Number(i.cost_price),
            discountedCost: (i.allocatedDiscount > 0) ? (i.unit_type === 'BOX' ? i.discountedBoxCost : i.discountedPieceCost) : null,
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
      setGiftsList([]);
      setProductSearch('');

      if (isEditMode && !exportPdf) {
        setIsEditMode(false);
        navigate('/financials');
        return;
      }

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
      
      {isEditMode && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '8px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ color: '#166534', fontSize: '0.86rem', fontWeight: 700 }}>
            <span>دەستکاریکردنی پسووڵەی #{invoiceNumber}</span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '3px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            پاشگەزبوونەوە
          </button>
        </div>
      )}

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
              type="text" 
              inputMode="decimal"
              value={paidAmount} 
              onChange={(e) => handlePaidAmountChange(cleanNumericInput(e.target.value))} 
              onFocus={placeCursorAtEnd}
              onClick={(e) => {
                if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                  placeCursorAtEnd(e);
                }
              }}
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
                direction: 'ltr',
                boxSizing: 'border-box',
                outline: 'none'
              }} 
            />
          </div>
        )}

        {/* Additional Cost Field */}
        <div style={{ width: '150px' }}>
          <input 
            type="text" 
            inputMode="decimal"
            value={additionalCost} 
            onChange={(e) => setAdditionalCost(cleanNumericInput(e.target.value))}
            onFocus={placeCursorAtEnd}
            onClick={(e) => {
              if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                placeCursorAtEnd(e);
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
              direction: 'ltr',
              boxSizing: 'border-box',
              outline: 'none'
            }} 
          />
        </div>

        {/* Gift (دیاری) Button */}
        <div>
          <button
            type="button"
            onClick={openGiftModal}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '6px',
              background: giftsList.length > 0 ? '#f0fdf4' : '#ffffff',
              border: giftsList.length > 0 ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
              color: giftsList.length > 0 ? '#15803d' : '#475569',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease'
            }}
          >
            <span>
              {giftsList.length === 0 
                ? 'دیاری' 
                : (giftsList.length === 1 
                    ? `دیاری: ${giftsList[0].name}` 
                    : `دیارییەکان (${giftsList.length})`)}
            </span>
          </button>
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
            <col style={{ width: '15%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '11%' }} />
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
              <th style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>هەبوو</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>شێوازی کڕین</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>بڕ</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center', fontSize: '0.80rem' }}>دانە/کێش لە کارتۆن</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>نرخی کڕین</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center', color: '#16a34a' }}>نرخی دوای داشکاندن</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>نرخی فرۆشتن (تاک)</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 8px', textAlign: 'center' }}>کۆی کڕین</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>کردار</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithLandedCost.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ border: '1px solid #e2e8f0', padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                  هیچ کاڵایەک لە پسووڵەکەدا نییە. بارکۆد لێبدە یان بە ناوی کاڵا بگەڕێ.
                </td>
              </tr>
            ) : (
              itemsWithLandedCost.map((item, index) => {
                const isBox = item.unit_type === 'BOX';
                const unitsPerBox = Math.max(1, parseFloat(item.units_per_box) || 1);
                const lineTotalCost = getItemLineTotal(item);

                return (
                  <tr 
                    key={index} 
                    id={`purchase-row-${index}`}
                    style={{ 
                      height: '42px', 
                      borderBottom: '1px solid #e2e8f0', 
                      transition: 'background 0.3s ease',
                      background: highlightedRowIndex === index ? '#fef3c7' : 'transparent'
                    }}
                    onMouseEnter={(e) => { if (highlightedRowIndex !== index) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { if (highlightedRowIndex !== index) e.currentTarget.style.background = 'transparent'; }}
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

                    {/* Unit Selector: Carton/Sack or Piece/KG */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>
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
                          {item.is_weighted ? 'گونیە' : 'کارتۆن'}
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
                          {item.is_weighted ? 'کگم' : 'دانە'}
                        </button>
                      </div>
                    </td>

                    {/* Quantity Input - Clean Single Centered Input */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={isBox ? item.box_quantity : item.quantity} 
                        onChange={(e) => updateItem(index, isBox ? 'box_quantity' : 'quantity', cleanNumericInput(e.target.value))} 
                        onFocus={placeCursorAtEnd}
                        onClick={(e) => {
                          if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                            placeCursorAtEnd(e);
                          }
                        }}
                        onBlur={(e) => {
                          const formatted = formatCleanQty(e.target.value);
                          if (formatted !== e.target.value) {
                            updateItem(index, isBox ? 'box_quantity' : 'quantity', formatted);
                          }
                        }}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        style={{
                          width: '65px',
                          height: '28px',
                          borderRadius: '4px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          textAlign: 'center',
                          direction: 'ltr',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          outline: 'none'
                        }} 
                      />
                    </td>

                    {/* Units per Box/Sack Input ("دانە لە کارتۆندا" / "کێش لە گونیەدا") */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 4px', textAlign: 'center' }}>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        disabled={!isBox}
                        value={isBox ? (formatCleanQty(item.units_per_box) ?? '') : (item.is_weighted ? (formatCleanQty(item.last_box_multiplier || item.units_per_box) || '1') : '1')} 
                        onChange={(e) => updateItem(index, 'units_per_box', cleanNumericInput(e.target.value))} 
                        onFocus={placeCursorAtEnd}
                        onClick={(e) => {
                          if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                            placeCursorAtEnd(e);
                          }
                        }}
                        onBlur={(e) => {
                          const formatted = formatCleanQty(e.target.value);
                          if (formatted !== e.target.value) {
                            updateItem(index, 'units_per_box', formatted);
                          }
                        }}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        style={{
                          width: '65px',
                          height: '28px',
                          borderRadius: '4px',
                          background: !isBox ? '#f1f5f9' : '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: !isBox ? '#94a3b8' : '#1e293b',
                          textAlign: 'center',
                          direction: 'ltr',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          outline: 'none',
                          cursor: !isBox ? 'not-allowed' : 'text'
                        }} 
                      />
                    </td>

                    {/* Cost Price Input - Clean Single Centered Input */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={isBox ? item.box_cost_price : item.cost_price} 
                        onChange={(e) => updateItem(index, isBox ? 'box_cost_price' : 'cost_price', cleanNumericInput(e.target.value))} 
                        onFocus={placeCursorAtEnd}
                        onClick={(e) => {
                          if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                            placeCursorAtEnd(e);
                          }
                        }}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                        style={{
                          width: '90px',
                          height: '28px',
                          borderRadius: '4px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          textAlign: 'center',
                          direction: 'ltr',
                          outline: 'none'
                        }} 
                      />
                    </td>

                    {/* Price After Discount (نرخی دوای داشکاندن) */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      {item.allocatedDiscount > 0 ? (
                        <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.86rem' }}>
                          {(isBox ? item.discountedBoxCost : item.discountedPieceCost).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.86rem' }}>-</span>
                      )}
                    </td>

                    {/* Selling Price (Per Piece) - Clean Gray Border */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '0 6px', textAlign: 'center' }}>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={item.selling_price} 
                        onChange={(e) => updateItem(index, 'selling_price', cleanNumericInput(e.target.value))} 
                        onFocus={placeCursorAtEnd}
                        onClick={(e) => {
                          if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                            placeCursorAtEnd(e);
                          }
                        }}
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
                          direction: 'ltr',
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

          {giftsList.length > 0 && totalGiftsDiscount > 0 && (
            <div style={{ color: '#15803d' }}>
              دیاری: <strong style={{ fontWeight: 800 }}>{totalGiftsDiscount.toLocaleString()} د.ع ({giftsList.length} جۆر)</strong>
            </div>
          )}
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
            {isEditMode ? "نوێکردنەوە و پاشەکەوت" : "تۆمارکردن"}
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
            {isEditMode ? "نوێکردنەوە و PDF" : "تۆمارکردن و PDF"}
          </button>
        </div>
      </div>

      {/* Quick Add Product Modal (Unified DRY Layout matching Products & Warehouse) */}
      <ProductModal
        isOpen={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddBarcode('');
        }}
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
        onCategoryDelete={(deletedId) => {
          setCategories(prev => prev.filter(x => x.id !== deletedId));
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
                  <td style={{ padding: '4px 0', textAlign: 'center' }}>{formatCleanQty(item.quantity)}</td>
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
          {printedInvoice.gifts && printedInvoice.gifts.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
              <span>داشکاندنی دیاری ({printedInvoice.gifts.length} جۆر):</span>
              <span>-{printedInvoice.gifts.reduce((s, g) => s + (Number(g.value) || 0), 0).toLocaleString()} د.ع</span>
            </div>
          )}
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

      {/* Dedicated Gift (دیاری) Minimalist Modal */}
      {giftModalOpen && (
        <div 
          onClick={() => setGiftModalOpen(false)}
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
              padding: '22px 26px',
              width: '860px',
              maxWidth: '95vw',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                دیارییەکان
              </h3>
              <button
                type="button"
                onClick={() => setGiftModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Two-Column Layout (Side-by-Side) */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

              {/* Right Column: Form to Add Gift */}
              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Gift Product Selection */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                    کاڵای دیاری
                  </label>
                  <input
                    type="text"
                    value={giftProductSearch}
                    onChange={(e) => {
                      setGiftProductSearch(e.target.value);
                      if (selectedGiftProduct && selectedGiftProduct.name !== e.target.value) {
                        setSelectedGiftProduct(null);
                      }
                    }}
                    placeholder="گەڕان بە ناوی کاڵا یان بارکۆد..."
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
                      color: '#1e293b',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                  {/* Product search dropdown */}
                  {giftFilteredProducts.length > 0 && !selectedGiftProduct && (
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
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}>
                      {giftFilteredProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectGiftProduct(p)}
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
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.84rem' }}>{p.name}</span>
                          <span style={{ color: '#64748b', fontSize: '0.80rem' }}>
                            {Math.round(Number(p.box_cost_price || p.cost_price || 0)).toLocaleString()} د.ع
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Packaging / Unit Type & Quantity */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                      شێوازی دیاری
                    </label>
                    <div style={{
                      display: 'flex',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #cbd5e1',
                      height: '38px',
                      boxSizing: 'border-box'
                    }}>
                      <button
                        type="button"
                        onClick={() => handleGiftUnitTypeChange('BOX')}
                        style={{
                          flex: 1,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: giftUnitType === 'BOX' ? 800 : 600,
                          background: giftUnitType === 'BOX' ? '#2563eb' : '#f8fafc',
                          color: giftUnitType === 'BOX' ? '#ffffff' : '#64748b',
                          fontSize: '0.82rem'
                        }}
                      >
                        کارتۆن
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGiftUnitTypeChange('PIECE')}
                        style={{
                          flex: 1,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: giftUnitType === 'PIECE' ? 800 : 600,
                          background: giftUnitType === 'PIECE' ? '#2563eb' : '#f8fafc',
                          color: giftUnitType === 'PIECE' ? '#ffffff' : '#64748b',
                          fontSize: '0.82rem'
                        }}
                      >
                        دانە
                      </button>
                    </div>
                  </div>

                  <div style={{ width: '120px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                      بڕی دیاری
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={giftQuantity}
                      onChange={(e) => handleGiftQuantityChange(cleanNumericInput(e.target.value))}
                      onFocus={placeCursorAtEnd}
                      onClick={(e) => {
                        if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                          placeCursorAtEnd(e);
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        direction: 'ltr',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Gift Value (Total Monetary Discount to be absorbed) */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                    بەهای دیاری (دینار)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={giftValue}
                    onChange={(e) => setGiftValue(cleanNumericInput(e.target.value))}
                    onFocus={placeCursorAtEnd}
                    onClick={(e) => {
                      if (e.target && e.target.selectionStart === 0 && e.target.value && e.target.value.length > 0) {
                        placeCursorAtEnd(e);
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      direction: 'ltr',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Discount Target Options */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                    داشکاندن بەسەر
                  </label>
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                      <input
                        type="radio"
                        name="giftAllocation"
                        checked={giftAllocationMode === 'ALL'}
                        onChange={() => setGiftAllocationMode('ALL')}
                      />
                      <span>گشت کاڵاکان</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                      <input
                        type="radio"
                        name="giftAllocation"
                        checked={giftAllocationMode === 'SELECTED'}
                        onChange={() => setGiftAllocationMode('SELECTED')}
                      />
                      <span>کاڵای دیاریکراو</span>
                    </label>
                  </div>

                  {/* Items Checklist (when SELECTED mode is active) */}
                  {giftAllocationMode === 'SELECTED' && (
                    <div style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      background: '#f8fafc'
                    }}>
                      {items.map((it, idx) => {
                        const itemKey = it.barcode || it.name || String(idx);
                        const isChecked = giftTargetKeys.includes(itemKey);
                        const lineCost = getItemLineTotal(it);
                        return (
                          <label 
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              background: isChecked ? '#f0fdf4' : '#ffffff',
                              border: isChecked ? '1px solid #86efac' : '1px solid #e2e8f0',
                              cursor: 'pointer',
                              fontSize: '0.80rem'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setGiftTargetKeys([...giftTargetKeys, itemKey]);
                                } else {
                                  setGiftTargetKeys(giftTargetKeys.filter(k => k !== itemKey));
                                }
                              }}
                            />
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{it.name}</span>
                            <span style={{ marginRight: 'auto', color: '#64748b', fontSize: '0.78rem' }}>
                              {lineCost.toLocaleString()} د.ع
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add Gift to List Button */}
                <button
                  type="button"
                  onClick={handleAddGiftToList}
                  style={{
                    height: '38px',
                    borderRadius: '6px',
                    background: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '2px'
                  }}
                >
                  <span>+</span>
                  <span>زیادکردنی ئەم دیارییە</span>
                </button>
              </div>

              {/* Left Column: Added Gifts List & Summary */}
              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#334155' }}>
                  دیارییە زیادکراوەکان
                </div>

                {giftsList.length === 0 ? (
                  <div style={{
                    minHeight: '220px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    color: '#94a3b8',
                    fontSize: '0.84rem'
                  }}>
                    هیچ دیارییەک زیاد نەکراوە
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    minHeight: '160px'
                  }}>
                    {giftsList.map((g) => (
                      <div
                        key={g.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
                              {g.name}
                            </span>
                            <span style={{
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              {g.quantity} {g.unit_type === 'BOX' ? 'کارتۆن' : 'دانە'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            بۆ: {getGiftTargetSummary(g)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#16a34a', direction: 'ltr' }}>
                            {Number(g.gift_value || 0).toLocaleString()} د.ع
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGiftFromList(g.id)}
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#b91c1c',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            سڕینەوە
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total Gifts Summary */}
                {giftsList.length > 0 && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.84rem'
                  }}>
                    <span style={{ fontWeight: 700, color: '#166534' }}>
                      کۆی گشتی داشکاندنی دیارییەکان:
                    </span>
                    <span style={{ fontWeight: 800, color: '#15803d', fontSize: '0.92rem', direction: 'ltr' }}>
                      {totalGiftsValue.toLocaleString()} د.ع
                    </span>
                  </div>
                )}

                {/* Save Button (NO CLOSE BUTTON) */}
                <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleSaveGiftModal}
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '6px',
                      background: '#16a34a',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    پاشەکەوتکردن
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Purchases;
