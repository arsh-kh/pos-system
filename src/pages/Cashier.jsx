import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Search,
  ScanBarcode, 
  Printer, 
  Zap, 
  X,
  Scale,
  Percent,
  Keyboard,
  Lock,
  Unlock,
  Tag,
  Package,
  Banknote,
  CreditCard,
  Layers,
  AlertCircle,
  ArrowRight,
  Store,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import './Dashboard.css';

const Cashier = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, canCashier } = useAuth();

  // Permission Flags for Cashier
  const allowManualDiscount = canCashier ? canCashier('allow_manual_discount') : true;
  const allowCustomPrice = canCashier ? canCashier('allow_custom_price') : true;
  const allowDeleteItem = canCashier ? canCashier('allow_delete_item') : true;
  const allowClearCart = canCashier ? canCashier('allow_clear_cart') : true;
  const allowDebtSale = canCashier ? canCashier('allow_debt_sale') : true;
  const allowSplitPayment = canCashier ? canCashier('allow_split_payment') : true;
  const allowViewCostPrice = canCashier ? canCashier('allow_view_cost_price') : false;

  // Multi-Cart State (Cart 1: Main, Cart 2: Quick-Sell)
  const [activeCartIndex, setActiveCartIndex] = useState(0);
  const [carts, setCarts] = useState([
    { id: 1, label: 'سەلە ١', shortcut: 'F6', items: [], customerId: '', discountType: 'AMOUNT', discountValue: '', paymentMode: 'CASH', splitCashAmount: '' },
    { id: 2, label: 'سەلە ٢', shortcut: 'F7', items: [], customerId: '', discountType: 'AMOUNT', discountValue: '', paymentMode: 'CASH', splitCashAmount: '' }
  ]);

  // Active Cart Proxies
  const currentCartData = carts[activeCartIndex] || carts[0];
  const cart = currentCartData.items;
  const selectedCustomerId = currentCartData.customerId;
  const discountType = currentCartData.discountType;
  const discountValue = currentCartData.discountValue;
  const paymentMode = currentCartData.paymentMode || (currentCartData.isDebtSale ? 'DEBT' : 'CASH');
  const splitCashAmount = currentCartData.splitCashAmount || '';
  const isDebtSale = paymentMode === 'DEBT';
  const isSplitSale = paymentMode === 'SPLIT';

  // Active Cart Updaters
  const updateActiveCart = (updater) => {
    setCarts(prevCarts => {
      const updated = [...prevCarts];
      const target = updated[activeCartIndex] || updated[0];
      const newTarget = typeof updater === 'function' ? updater(target) : { ...target, ...updater };
      updated[activeCartIndex] = newTarget;
      return updated;
    });
  };

  const setCart = (itemsOrFn) => {
    updateActiveCart(curr => {
      const newItems = typeof itemsOrFn === 'function' ? itemsOrFn(curr.items) : itemsOrFn;
      return { ...curr, items: newItems };
    });
  };

  const setSelectedCustomerId = (val) => {
    updateActiveCart(curr => ({ ...curr, customerId: typeof val === 'function' ? val(curr.customerId) : val }));
  };

  const setDiscountType = (val) => {
    updateActiveCart(curr => ({ ...curr, discountType: typeof val === 'function' ? val(curr.discountType) : val }));
  };

  const setDiscountValue = (val) => {
    updateActiveCart(curr => ({ ...curr, discountValue: typeof val === 'function' ? val(curr.discountValue) : val }));
  };

  const setPaymentMode = (mode) => {
    updateActiveCart(curr => ({ ...curr, paymentMode: mode, isDebtSale: mode === 'DEBT' }));
  };

  const setSplitCashAmount = (val) => {
    updateActiveCart(curr => ({ ...curr, splitCashAmount: typeof val === 'function' ? val(curr.splitCashAmount) : val }));
  };

  const setIsDebtSale = (val) => {
    const isDebt = typeof val === 'function' ? val(paymentMode === 'DEBT') : val;
    setPaymentMode(isDebt ? 'DEBT' : 'CASH');
  };

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activePromotions, setActivePromotions] = useState({});
  const [loading, setLoading] = useState(true);

  // Cashier Controls
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);
  const discountInputRef = useRef(null);

  // Quick Custom Item State
  const [isQuickItemModalOpen, setIsQuickItemModalOpen] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState('');
  const [quickItemQty, setQuickItemQty] = useState('1');

  // Scale / Weighted Items State
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [scaleItemName, setScaleItemName] = useState('');
  const [scalePricePerKg, setScalePricePerKg] = useState('');
  const [scaleWeight, setScaleWeight] = useState('1.000');
  const [scaleSelectedProductId, setScaleSelectedProductId] = useState('');

  // Quick Inline Customer Modal State
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerDebt, setQuickCustomerDebt] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Fast Uncatalogued Barcode Modal State
  const [isUncataloguedModalOpen, setIsUncataloguedModalOpen] = useState(false);
  const [uncataloguedBarcode, setUncataloguedBarcode] = useState('');
  const [uncataloguedName, setUncataloguedName] = useState('');
  const [uncataloguedPrice, setUncataloguedPrice] = useState('');
  const [saveToProductCatalog, setSaveToProductCatalog] = useState(true);

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Receipt Print State
  const [printedReceipt, setPrintedReceipt] = useState(null);
  const [autoPrint, setAutoPrint] = useState(() => {
    return localStorage.getItem('pos_auto_print') === 'true';
  });
  const [checkoutNotice, setCheckoutNotice] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی نموونەیی';
  const storePhone = localStorage.getItem('pos_store_phone') || '0750 000 0000';

  const fetchData = async () => {
    try {
      const [prodRes, custRes, catRes, promoRes] = await Promise.all([
        axios.get('http://localhost:3001/api/products'),
        axios.get('http://localhost:3001/api/customers'),
        axios.get('http://localhost:3001/api/categories'),
        axios.get('http://localhost:3001/api/promotions/active')
      ]);

      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
      if (custRes.data.status === 'SUCCESS') setCustomers(custRes.data.data);
      if (catRes.data.status === 'SUCCESS') setCategories(catRes.data.data);
      if (promoRes.data.status === 'SUCCESS') setActivePromotions(promoRes.data.activeMap || {});
    } catch (err) {
      console.error('Failed to load cashier resources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Hardware Wedge Barcode Scanner Listener
  useBarcodeScanner((scannedCode) => {
    handleProcessBarcode(scannedCode);
  });

  // Reprint Last Receipt Directly (F8 Shortcut or Header Button)
  const handleReprintLastReceipt = () => {
    let targetReceipt = printedReceipt;
    if (!targetReceipt) {
      try {
        const saved = localStorage.getItem('pos_last_receipt');
        if (saved) targetReceipt = JSON.parse(saved);
      } catch (_) {}
    }
    if (!targetReceipt) {
      alert('هیچ پسووڵەیەکی پێشوو بۆ چاپکردنەوە نەدۆزرایەوە');
      return;
    }
    setPrintedReceipt(targetReceipt);
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('print-receipt', targetReceipt);
      } catch (_) {}
    }
    setTimeout(() => window.print(), 100);
  };

  // Global Keyboard Shortcuts (F1, F2, F3, F4, F6, F7, F8, F9, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setIsQuickItemModalOpen(prev => !prev);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsScaleModalOpen(prev => !prev);
      } else if (e.key === 'F4') {
        e.preventDefault();
        discountInputRef.current?.focus();
      } else if (e.key === 'F6' || (e.ctrlKey && e.key === '1')) {
        e.preventDefault();
        setActiveCartIndex(0);
      } else if (e.key === 'F7' || (e.ctrlKey && e.key === '2')) {
        e.preventDefault();
        setActiveCartIndex(1);
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleReprintLastReceipt();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isCheckingOut) {
          handleCheckout();
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleOpenCashDrawer();
      } else if (e.key === 'Escape') {
        setIsQuickItemModalOpen(false);
        setIsScaleModalOpen(false);
        setIsQuickCustomerModalOpen(false);
        setIsUncataloguedModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Cart Add & Update
  const addToCart = (product, addQty = 1, unitType = 'PIECE') => {
    setCart(prevCart => {
      const isBox = unitType === 'BOX';
      const unitsPerBox = Math.max(1, parseFloat(product.units_per_box) || 1);
      const singlePrice = Number(product.selling_price) || 0;
      const boxPrice = Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : Math.round(singlePrice * unitsPerBox);
      const effectivePrice = isBox ? boxPrice : singlePrice;
      const cartKey = `${product.id}_${unitType}`;

      const existingIdx = prevCart.findIndex(item => (item.cartKey === cartKey) || (item.id === product.id && (item.unit_type || 'PIECE') === unitType));

      if (existingIdx >= 0) {
        const updated = [...prevCart];
        const newQty = Math.round((Number(updated[existingIdx].quantity) + Number(addQty)) * 1000) / 1000;
        updated[existingIdx].quantity = Math.max(0.001, newQty);
        return updated;
      } else {
        return [
          ...prevCart,
          {
            id: product.id,
            cartKey: cartKey,
            baseName: product.name,
            name: isBox ? `${product.name} (کارتۆن - ${unitsPerBox} دانە)` : product.name,
            barcode: product.barcode,
            box_barcode: product.box_barcode,
            price: effectivePrice,
            single_price: singlePrice,
            wholesale_price: Number(product.wholesale_price) || 0,
            units_per_box: unitsPerBox,
            unit_type: unitType,
            stock: product.stock || 0,
            quantity: Math.max(0.001, Number(addQty)),
            unit: isBox ? 'کارتۆن' : (product.unit || 'دانە')
          }
        ];
      }
    });
  };

  const setItemUnitType = (key, targetUnitType) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.cartKey !== key && item.barcode !== key) return item;
        if (item.unit_type === targetUnitType) return item;

        const isToBox = targetUnitType === 'BOX';
        const unitsPerBox = Number(item.units_per_box) || 1;
        const singlePrice = Number(item.single_price) || Number(item.price);
        const boxPrice = Number(item.wholesale_price) > 0 ? Number(item.wholesale_price) : Math.round(singlePrice * unitsPerBox);
        const baseName = item.baseName || item.name.replace(/\s*\(کارتۆن.*?\)/, '');

        return {
          ...item,
          cartKey: `${item.id}_${targetUnitType}`,
          unit_type: targetUnitType,
          price: isToBox ? boxPrice : singlePrice,
          name: isToBox ? `${baseName} (کارتۆن - ${unitsPerBox} دانە)` : baseName,
          unit: isToBox ? 'کارتۆن' : 'دانە'
        };
      });
    });
  };

  const updateQuantity = (key, newQty) => {
    const qty = parseFloat(newQty);
    if (isNaN(qty)) return;
    if (qty <= 0) {
      if (!allowDeleteItem) {
        alert('بەڕێوەبەر سڕینەوەی کاڵای بۆ کاشێر قفڵ کردووە');
        return;
      }
      removeFromCart(key);
      return;
    }
    const roundedQty = Math.round(qty * 1000) / 1000;
    setCart(prev => prev.map(item => (item.cartKey === key || item.barcode === key) ? { ...item, quantity: roundedQty } : item));
  };

  const removeFromCart = (key) => {
    if (!allowDeleteItem) {
      alert('بەڕێوەبەر دەسەڵاتی سڕینەوەی کاڵای لە سەبەتە قفڵ کردووە');
      return;
    }
    setCart(prev => prev.filter(item => item.cartKey !== key && item.barcode !== key));
  };

  const clearCart = () => {
    if (!allowClearCart) {
      alert('بەڕێوەبەر بەتاڵکردنەوەی گشتی سەبەتەی قفڵ کردووە');
      return;
    }
    updateActiveCart({
      items: [],
      customerId: '',
      paymentMode: 'CASH',
      splitCashAmount: '',
      isDebtSale: false,
      discountValue: ''
    });
  };

  // Add Quick Custom Item
  const handleAddQuickCustomItem = (e) => {
    e.preventDefault();
    const price = Math.max(0, parseInt(quickItemPrice) || 0);
    if (price <= 0) {
      alert('تکایە نرخێکی دروست بنووسە');
      return;
    }
    const qty = Math.max(1, parseInt(quickItemQty) || 1);
    const name = quickItemName.trim() || 'کاڵای دەستی / گشتی';
    const customItem = {
      id: `custom_${Date.now()}`,
      name: name,
      barcode: `CUSTOM_${Date.now()}`,
      price: price,
      selling_price: price,
      stock: 999,
      quantity: qty,
      is_custom: true,
      unit: 'دانە'
    };
    setCart(prev => [customItem, ...prev]);
    setQuickItemName('');
    setQuickItemPrice('');
    setQuickItemQty('1');
    setIsQuickItemModalOpen(false);
  };

  // Add Scale / Weighted Item (سەوزە و میوە بە کێش)
  const handleAddScaleItem = (e) => {
    e.preventDefault();
    const pricePerKg = Math.max(0, parseInt(scalePricePerKg) || 0);
    const weight = Math.max(0.001, parseFloat(scaleWeight) || 0);
    if (pricePerKg <= 0 || weight <= 0) {
      alert('تکایە نرخ و کێشێکی دروست بنووسە');
      return;
    }
    const name = scaleItemName.trim() || 'کاڵا بە کێش / تەرازوو';
    const selectedProd = scaleSelectedProductId ? products.find(p => String(p.id) === String(scaleSelectedProductId)) : null;
    const isCustomScale = !selectedProd;

    const scaleItem = {
      id: selectedProd ? selectedProd.id : `scale_${Date.now()}`,
      cartKey: selectedProd ? `${selectedProd.id}_PIECE` : `scale_${Date.now()}`,
      name: selectedProd ? `${selectedProd.name} (${weight} کگم)` : `${name} (${weight} کگم)`,
      barcode: selectedProd ? selectedProd.barcode : `SCALE_${Date.now()}`,
      price: pricePerKg,
      selling_price: pricePerKg,
      stock: selectedProd ? selectedProd.stock : 999,
      quantity: weight,
      is_custom: isCustomScale,
      is_weighted: true,
      unit: 'کگم',
      unit_type: 'PIECE',
      units_per_box: 1
    };
    setCart(prev => [scaleItem, ...prev]);
    setScaleItemName('');
    setScalePricePerKg('');
    setScaleWeight('1.000');
    setScaleSelectedProductId('');
    setIsScaleModalOpen(false);
  };

  const handleSelectProductForScale = (prodId) => {
    setScaleSelectedProductId(prodId);
    const prod = products.find(p => String(p.id) === String(prodId));
    if (prod) {
      setScaleItemName(prod.name);
      setScalePricePerKg(prod.selling_price.toString());
    }
  };

  // Open Cash Drawer Trigger
  const handleOpenCashDrawer = () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('open-cash-drawer');
      } catch (_) {}
    }
    setCheckoutNotice({
      message: 'قاسی پارە کرایەوە 🔓',
      receipt: null
    });
    setTimeout(() => setCheckoutNotice(null), 2500);
  };

  // Barcode Handler (Hardware wedge + manual input + electronic scale barcodes)
  const handleProcessBarcode = (code) => {
    if (!code) return;
    const cleanCode = code.trim();

    // 1. Check if barcode matches a carton/box barcode directly
    const productBox = products.find(p => p.box_barcode && String(p.box_barcode).trim() === cleanCode);
    if (productBox) {
      addToCart(productBox, 1, 'BOX');
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
      return;
    }

    // 2. Check if barcode matches a single piece barcode directly
    const productPiece = products.find(p => String(p.barcode).trim() === cleanCode);
    if (productPiece) {
      addToCart(productPiece, 1, 'PIECE');
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
      return;
    }

    // 3. Electronic Digital Scale Barcode (EAN-13 variable weight / price barcodes)
    // Standard supermarket format: Starts with 20, 21, or 22 with 13 digits (e.g. 2000123015004)
    if (cleanCode.length === 13 && (cleanCode.startsWith('20') || cleanCode.startsWith('21') || cleanCode.startsWith('22'))) {
      const itemCodeRaw = cleanCode.substring(2, 7);
      const itemCodeTrimmed = itemCodeRaw.replace(/^0+/, '');
      const rawValue = parseInt(cleanCode.substring(7, 12), 10);
      const weightInKg = Math.max(0.001, rawValue / 1000);

      // Find matching scale item by barcode or ID
      const scaleProd = products.find(p => 
        String(p.barcode).trim() === itemCodeRaw ||
        String(p.barcode).trim() === itemCodeTrimmed ||
        String(p.barcode).trim().endsWith(itemCodeTrimmed) ||
        String(p.id) === itemCodeTrimmed
      );

      if (scaleProd) {
        const item = {
          id: scaleProd.id,
          cartKey: `${scaleProd.id}_scale_${Date.now()}`,
          name: `${scaleProd.name} (${weightInKg} کگم)`,
          baseName: scaleProd.name,
          barcode: cleanCode,
          price: scaleProd.selling_price,
          single_price: scaleProd.selling_price,
          selling_price: scaleProd.selling_price,
          wholesale_price: scaleProd.wholesale_price || 0,
          stock: scaleProd.stock,
          quantity: weightInKg,
          unit: 'کگم',
          unit_type: 'PIECE',
          units_per_box: 1,
          is_weighted: true
        };
        setCart(prev => [item, ...prev]);
        setBarcodeInput('');
        barcodeInputRef.current?.focus();
        return;
      } else {
        // Product PLU not yet catalogued -> Pre-fill scale modal for fast entry
        setScaleItemName(`کاڵای کێشراو (${itemCodeTrimmed})`);
        setScaleWeight(weightInKg.toFixed(3));
        setScalePricePerKg('');
        setIsScaleModalOpen(true);
        setBarcodeInput('');
        return;
      }
    }

    // 4. Uncatalogued barcode scanned -> Fast Price Entry Modal (Non-blocking)
    setUncataloguedBarcode(cleanCode);
    setUncataloguedName(`کاڵا (${cleanCode})`);
    setUncataloguedPrice('');
    setSaveToProductCatalog(true);
    setIsUncataloguedModalOpen(true);
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (barcodeInput) {
      handleProcessBarcode(barcodeInput);
    }
  };

  // Add Uncatalogued Item Directly to Cart (and optionally to database in background)
  const handleAddUncataloguedItem = async (e) => {
    e.preventDefault();
    const price = Math.max(0, parseInt(uncataloguedPrice) || 0);
    if (price <= 0) {
      alert('تکایە نرخێکی دروست بنووسە');
      return;
    }
    const name = uncataloguedName.trim() || `کاڵا (${uncataloguedBarcode})`;
    const code = uncataloguedBarcode.trim();

    const cartKey = `uncat_${code}_${Date.now()}`;
    const item = {
      id: `uncat_${Date.now()}`,
      cartKey: cartKey,
      baseName: name,
      name: name,
      barcode: code,
      price: price,
      single_price: price,
      wholesale_price: 0,
      units_per_box: 1,
      unit_type: 'PIECE',
      stock: 999,
      quantity: 1,
      unit: 'دانە',
      is_custom: true
    };
    setCart(prev => [item, ...prev]);

    // Save to product catalog in background if requested
    if (saveToProductCatalog) {
      try {
        const payload = {
          name: name,
          barcode: code,
          cost_price: 0,
          selling_price: price,
          stock: 99,
          category_id: categories[0]?.id || null
        };
        const token = localStorage.getItem('token');
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        axios.post('http://localhost:3001/api/products', payload, config).then(res => {
          if (res.data?.status === 'SUCCESS') {
            setProducts(prev => [res.data.data, ...prev]);
          }
        }).catch(() => {});
      } catch (_) {}
    }

    setIsUncataloguedModalOpen(false);
    setUncataloguedBarcode('');
    setUncataloguedName('');
    setUncataloguedPrice('');
    barcodeInputRef.current?.focus();
  };

  // Save Quick Inline Customer
  const handleSaveQuickCustomer = async (e) => {
    e.preventDefault();
    if (!quickCustomerName.trim()) {
      alert('تکایە ناوی کڕیار بنووسە');
      return;
    }
    setIsSavingCustomer(true);
    try {
      const payload = {
        name: quickCustomerName.trim(),
        phone: quickCustomerPhone.trim() || null,
        total_debt: Math.max(0, parseInt(quickCustomerDebt) || 0)
      };
      const res = await axios.post('http://localhost:3001/api/customers', payload);
      if (res.data.status === 'SUCCESS' || res.status === 201) {
        const newCust = res.data.data;
        setCustomers(prev => [newCust, ...prev]);
        setSelectedCustomerId(newCust.id);
        setIsQuickCustomerModalOpen(false);
        setQuickCustomerName('');
        setQuickCustomerPhone('');
        setQuickCustomerDebt('');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە زیادکردنی کڕیار');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Helper: Calculate item pricing considering active promotion & tiered quantity limits
  const getItemPricing = useCallback((item) => {
    // If item is sold as a carton/box, wholesale price applies directly
    if (item.unit_type === 'BOX') {
      const boxPrice = Number(item.price);
      const qty = Number(item.quantity);
      return {
        hasPromo: false,
        promoQty: 0,
        regularQty: qty,
        promoPrice: boxPrice,
        regularPrice: boxPrice,
        maxLimit: null,
        lineTotal: Math.round(boxPrice * qty),
        totalSavings: 0
      };
    }

    const promo = activePromotions[item.id];
    const regularPrice = Number(item.price);
    const qty = Number(item.quantity);

    if (!promo || promo.savings_per_unit <= 0) {
      return {
        hasPromo: false,
        promoQty: 0,
        regularQty: qty,
        promoPrice: regularPrice,
        regularPrice: regularPrice,
        maxLimit: null,
        lineTotal: Math.round(regularPrice * qty),
        totalSavings: 0
      };
    }

    const promoPrice = promo.promo_price;
    const maxLimit = promo.max_qty_per_sale ? Number(promo.max_qty_per_sale) : Infinity;
    const promoQty = Math.min(qty, maxLimit);
    const regularQty = Math.max(0, qty - promoQty);
    const lineTotal = Math.round((promoQty * promoPrice) + (regularQty * regularPrice));
    const totalSavings = Math.max(0, Math.round(qty * regularPrice) - lineTotal);

    return {
      hasPromo: true,
      promoQty,
      regularQty,
      promoPrice,
      regularPrice,
      maxLimit: promo.max_qty_per_sale,
      lineTotal,
      totalSavings
    };
  }, [activePromotions]);

  // Subtotal Calculation before General Invoice Discount (with promo pricing applied)
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + getItemPricing(item).lineTotal, 0);
  }, [cart, getItemPricing]);

  // Total Savings from Active Product Promotions
  const totalPromotionalSavings = useMemo(() => {
    return cart.reduce((acc, item) => acc + getItemPricing(item).totalSavings, 0);
  }, [cart, getItemPricing]);

  // General Invoice Discount Calculation (IQD Amount or Percentage %)
  const calculatedDiscount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0 || subtotal <= 0) return 0;
    if (discountType === 'PERCENT') {
      return Math.min(subtotal, Math.round((subtotal * Math.min(100, val)) / 100));
    }
    return Math.min(subtotal, Math.round(val));
  }, [subtotal, discountType, discountValue]);

  // Net Grand Total after all Discounts
  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - calculatedDiscount);
  }, [subtotal, calculatedDiscount]);

  // Selected customer details
  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  // Split payment effective cash and debt calculations
  const effectiveCashPaid = useMemo(() => {
    if (paymentMode === 'CASH') return grandTotal;
    if (paymentMode === 'DEBT') return 0;
    if (paymentMode === 'SPLIT') {
      const parsed = parseFloat(splitCashAmount);
      if (isNaN(parsed) || parsed < 0) return 0;
      return Math.min(grandTotal, Math.round(parsed));
    }
    return grandTotal;
  }, [paymentMode, splitCashAmount, grandTotal]);

  const effectiveDebtAmount = useMemo(() => {
    if (paymentMode === 'CASH') return 0;
    if (paymentMode === 'DEBT') return grandTotal;
    if (paymentMode === 'SPLIT') {
      return Math.max(0, grandTotal - effectiveCashPaid);
    }
    return 0;
  }, [paymentMode, grandTotal, effectiveCashPaid]);

  // Process Checkout
  const handleCheckout = async (forcePrint = null) => {
    if (cart.length === 0) return alert('عەرەبانەی کڕین واڵایە!');
    if ((paymentMode === 'DEBT' || paymentMode === 'SPLIT') && !selectedCustomerId) {
      return alert('تکایە سەرەتا کڕیارێک دیاریبکە بۆ فرۆشتن بە قەرز یان فرە-جۆر (تێکەڵ)');
    }

    const shouldPrint = forcePrint !== null ? forcePrint : autoPrint;

    setIsCheckingOut(true);
    try {
      const payload = {
        items: cart.map(i => ({
          barcode: i.barcode,
          quantity: i.quantity,
          is_custom: i.is_custom || false,
          price: i.price,
          name: i.name,
          unit_type: i.unit_type || 'PIECE',
          units_per_box: i.units_per_box || 1
        })),
        customer_id: selectedCustomerId || null,
        paid_amount: effectiveCashPaid,
        pay_later_amount: effectiveDebtAmount,
        payment_method: paymentMode,
        subtotal_amount: subtotal,
        discount_amount: calculatedDiscount
      };

      const res = await axios.post('http://localhost:3001/api/checkout', payload);
      if (res.data.status === 'SUCCESS') {
        const saleId = res.data.saleId;
        
        // Prepare Receipt Data with Promotion Breakdown & Split Payment details
        const receiptData = {
          saleId,
          date: new Date().toLocaleString('en-US', { hour12: true }),
          customerName: selectedCustomer ? selectedCustomer.name : 'کڕیاری گشتی',
          customerPhone: selectedCustomer ? selectedCustomer.phone : '',
          paymentMethod: paymentMode,
          paidAmount: effectiveCashPaid,
          debtAmount: effectiveDebtAmount,
          isDebt: paymentMode === 'DEBT',
          isSplit: paymentMode === 'SPLIT',
          subtotal: subtotal,
          promotionalSavings: totalPromotionalSavings,
          discount: calculatedDiscount,
          total: grandTotal,
          items: cart.map(i => {
            const pricing = getItemPricing(i);
            return {
              name: i.name,
              quantity: i.quantity,
              price: i.price,
              total: pricing.lineTotal,
              hasPromo: pricing.hasPromo,
              promoSavings: pricing.totalSavings,
              unit: i.unit || 'دانە',
              unit_type: i.unit_type || 'PIECE'
            };
          })
        };

        setPrintedReceipt(receiptData);
        try {
          localStorage.setItem('pos_last_receipt', JSON.stringify(receiptData));
        } catch (_) {}

        // Only print if requested
        if (shouldPrint) {
          if (window.require) {
            try {
              const { ipcRenderer } = window.require('electron');
              ipcRenderer.send('print-receipt', receiptData);
            } catch (_) {}
          }
          setTimeout(() => {
            window.print();
          }, 100);
        }

        // Auto kick cash drawer if cash was received
        if (paymentMode === 'CASH' || (paymentMode === 'SPLIT' && (Number(paidAmount) || 0) > 0)) {
          if (window.require) {
            try {
              const { ipcRenderer } = window.require('electron');
              ipcRenderer.send('open-cash-drawer');
            } catch (_) {}
          }
        }

        setCheckoutNotice({
          message: `فرۆشتن بە سەرکەوتوویی ئەنجامدرا! کۆی گشتی: ${grandTotal.toLocaleString()} دینار`,
          receipt: receiptData
        });
        setTimeout(() => setCheckoutNotice(null), 4000);

        clearCart();
        fetchData();
        // Smart Auto-Return: If finished checking out on a quick cart (Cart 2 or Cart 3) and Cart 1 has items, return to Cart 1
        setCarts(prevCarts => {
          if (activeCartIndex !== 0 && prevCarts[0].items.length > 0) {
            setActiveCartIndex(0);
          }
          return prevCarts;
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی فرۆشتن');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Filtered Products for Quick Selection Grid
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = kurdishSearchMatch([p.name, p.barcode, p.box_barcode], productSearch);

      const matchesCat = 
        selectedCategoryId === 'ALL' || 
        String(p.category_id) === String(selectedCategoryId);

      return matchesSearch && matchesCat;
    });
  }, [products, productSearch, selectedCategoryId]);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', padding: '6px 10px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }} dir="rtl">
      
      {/* Thermal Print Receipt Style */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #cashier-thermal-receipt, #cashier-thermal-receipt * {
            visibility: visible !important;
          }
          #cashier-thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            background: white !important;
            color: black !important;
            padding: 8px 10px !important;
            font-family: monospace, Tahoma, sans-serif !important;
            font-size: 13px !important;
            direction: rtl !important;
            text-align: right !important;
          }
          .receipt-divider {
            border-bottom: 1px dashed #000 !important;
            margin: 6px 0 !important;
          }
        }
      `}</style>

      {/* Non-Blocking Sale Success & Quick Print Banner */}
      {checkoutNotice && (
        <div style={{
          position: 'fixed',
          top: '14px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--success-color)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 9999,
          fontWeight: 800,
          fontSize: '0.88rem'
        }}>
          <span>✅ {checkoutNotice.message}</span>
          <button
            type="button"
            onClick={() => {
              setPrintedReceipt(checkoutNotice.receipt);
              setTimeout(() => window.print(), 100);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Printer size={14} /> چاپکردنی پسووڵە
          </button>
          <button
            type="button"
            onClick={() => setCheckoutNotice(null)}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '2px', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Slim Top Cashier Navigation Bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        marginBottom: '6px',
        borderRadius: '8px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}
            title="گەڕانەوە بۆ پەڕەی سەرەکی"
          >
            <ArrowRight size={14} />
            <span>سەرەکی</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            <Store size={16} color="var(--primary-color)" />
            <span>خاڵی فرۆشتن (کاشێر)</span>
          </div>

          <div style={{ height: '16px', width: '1px', background: 'var(--border-color)' }} />

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <User size={13} />
            <span>{currentUser?.username || 'کاشێری سەرەکی'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button" 
            onClick={handleReprintLastReceipt}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '5px', 
              background: 'rgba(56, 189, 248, 0.12)', 
              color: '#38bdf8', 
              border: '1px solid rgba(56, 189, 248, 0.35)', 
              borderRadius: '6px', 
              padding: '4px 10px', 
              fontSize: '0.78rem', 
              cursor: 'pointer',
              fontWeight: 700
            }}
            title="چاپکردنەوەی دوایین پسووڵە (F8)"
          >
            <Printer size={12} /> چاپکردنەوە (F8)
          </button>

          <button 
            type="button" 
            onClick={() => navigate('/shifts')}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '5px', 
              background: 'var(--success-light)', 
              color: 'var(--success-color)', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              borderRadius: '6px', 
              padding: '4px 10px', 
              fontSize: '0.78rem', 
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            <Lock size={12} /> قاسە و شیفت
          </button>

          <button 
            type="button" 
            onClick={handleOpenCashDrawer}
            title="کردنەوەی قاسی پارە (F10)"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '5px', 
              background: 'rgba(16, 185, 129, 0.12)', 
              color: '#10b981', 
              border: '1px solid rgba(16, 185, 129, 0.35)', 
              borderRadius: '6px', 
              padding: '4px 10px', 
              fontSize: '0.78rem', 
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            <Unlock size={12} /> قاسی پارە (F10)
          </button>

          <button 
            type="button" 
            onClick={() => navigate('/promotions')}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '5px', 
              background: 'rgba(217, 119, 6, 0.12)', 
              color: '#d97706', 
              border: '1px solid rgba(217, 119, 6, 0.35)', 
              borderRadius: '6px', 
              padding: '4px 10px', 
              fontSize: '0.78rem', 
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            <Tag size={12} /> ئۆفەرەکان
          </button>
        </div>
      </header>

      {/* Main Single-Screen Non-Scrolling Layout */}
      <div style={{ display: 'flex', gap: '10px', height: 'calc(100vh - 54px)', overflow: 'hidden' }}>
        
        {/* Left Side: Products Catalog & Scan Input */}
        <div style={{ flex: '1 1 56%', minWidth: '320px', display: 'flex', flexDirection: 'column', height: '100%', gap: '6px' }}>
          
          {/* Top Barcode Input & Search Header */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            padding: '6px 10px', 
            borderRadius: '10px', 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center',
            flexShrink: 0
          }}>
            <form onSubmit={handleBarcodeSubmit} style={{ flex: '1 1 55%', display: 'flex', gap: '6px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <ScanBarcode size={17} color="var(--primary-color)" style={{ position: 'absolute', right: '10px', top: '8px' }} />
                <input 
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="سکانکردنی بارکۆد (F1)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  autoFocus
                  style={{ 
                    width: '100%', 
                    padding: '7px 32px 7px 10px', 
                    borderRadius: '8px', 
                    background: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-primary)', 
                    fontFamily: 'monospace', 
                    fontSize: '0.88rem' 
                  }}
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary"
                style={{ padding: '0 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.84rem' }}
              >
                سکان
              </button>
            </form>

            <div style={{ 
              flex: '1 1 45%', 
              display: 'flex', 
              alignItems: 'center', 
              background: 'var(--bg-tertiary)', 
              padding: '5px 10px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)' 
            }}>
              <Search size={15} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="گەڕان بە ناوی کاڵا..." 
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', marginRight: '6px', outline: 'none', width: '100%', fontSize: '0.86rem', boxShadow: 'none', padding: 0 }}
              />
            </div>
          </div>

          {/* Category Quick Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedCategoryId('ALL')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: selectedCategoryId === 'ALL' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                fontWeight: selectedCategoryId === 'ALL' ? 700 : 600,
                background: selectedCategoryId === 'ALL' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: selectedCategoryId === 'ALL' ? '#ffffff' : 'var(--text-primary)',
                fontSize: '0.84rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: selectedCategoryId === 'ALL' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
              }}
            >
              هەموو ({products.length})
            </button>
            {categories.map(cat => {
              const isActive = String(selectedCategoryId) === String(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: isActive ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 700 : 600,
                    background: isActive ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    fontSize: '0.84rem',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Quick Products Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 2px' }}>
            {filteredProducts.map(p => {
              const promo = activePromotions[p.id];
              const isOutOfStock = p.stock <= 0;
              const hasCarton = p.units_per_box > 1 || p.wholesale_price > 0;

              return (
                <div
                  key={p.id}
                  onClick={() => addToCart(p, 1, 'PIECE')}
                  className={`pos-product-card ${promo ? 'has-promo' : ''}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: promo ? '1.5px solid rgba(217, 119, 6, 0.45)' : '1px solid var(--border-color)',
                    background: promo ? 'linear-gradient(180deg, rgba(217, 119, 6, 0.08) 0%, var(--bg-secondary) 100%)' : 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '165px',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'visible',
                    boxShadow: promo ? '0 2px 8px rgba(217, 119, 6, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  {/* Top Meta: Stock & Promo Tag */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', minHeight: '22px' }}>
                    <div style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                      {isOutOfStock ? (
                        <span style={{ 
                          background: 'rgba(239, 68, 68, 0.12)', 
                          color: '#dc2626', 
                          border: '1px solid rgba(239, 68, 68, 0.3)', 
                          padding: '2px 7px', 
                          borderRadius: '6px' 
                        }}>
                          ⚠️ تەواوبوو
                        </span>
                      ) : (
                        <span style={{ 
                          background: 'var(--bg-tertiary)', 
                          color: 'var(--text-secondary)', 
                          border: '1px solid var(--border-color)', 
                          padding: '2px 7px', 
                          borderRadius: '6px' 
                        }}>
                          کۆگا: {p.stock}
                        </span>
                      )}
                    </div>

                    {promo && (
                      <span style={{ 
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                        color: '#ffffff', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        fontSize: '0.72rem', 
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)'
                      }}>
                        <Tag size={10} /> ئۆفەر
                      </span>
                    )}
                  </div>

                  {/* Product Title */}
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: '0.92rem', 
                    display: '-webkit-box', 
                    WebkitLineClamp: 2, 
                    WebkitBoxOrient: 'vertical', 
                    overflow: 'hidden', 
                    lineHeight: '1.4',
                    minHeight: '2.8em',
                    wordBreak: 'break-word',
                    color: 'var(--text-primary)',
                    margin: '2px 0 8px 0'
                  }}>
                    {p.name}
                  </div>

                  {/* Pricing and Action Strip */}
                  <div style={{ marginTop: 'auto' }}>
                    {/* Price Row */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                      {promo ? (
                        <>
                          <span style={{ color: '#d97706', fontWeight: 900, fontSize: '1.18rem', lineHeight: '1', letterSpacing: '-0.02em' }}>
                            {Number(promo.promo_price).toLocaleString()} د.ع
                          </span>
                          <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: '0.78rem', fontWeight: 500 }}>
                            {Number(p.selling_price).toLocaleString()}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--accent-hover)', fontWeight: 900, fontSize: '1.2rem', lineHeight: '1', letterSpacing: '-0.02em' }}>
                          {Number(p.selling_price).toLocaleString()} د.ع
                        </span>
                      )}
                    </div>

                    {/* Unit & Carton Buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(p, 1, 'PIECE');
                        }}
                        style={{
                          flex: 1,
                          height: '34px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          background: 'var(--accent-light)',
                          color: 'var(--accent-color)',
                          border: '1px solid rgba(37, 99, 235, 0.25)',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        +١ {p.unit || 'دانە'}
                      </button>

                      {hasCarton && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p, 1, 'BOX');
                          }}
                          title={`زیادکردنی ١ کارتۆن (${p.units_per_box || 1} دانە) بە نرخی ${Number(p.wholesale_price).toLocaleString()} د.ع`}
                          style={{
                            flex: 1,
                            height: '34px',
                            padding: '0 8px',
                            borderRadius: '8px',
                            background: 'rgba(2, 132, 199, 0.1)',
                            border: '1px solid rgba(2, 132, 199, 0.35)',
                            color: '#0284c7',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Package size={12} /> کارتۆن
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Interactive Cart & Direct Checkout */}
        <div style={{ flex: '1 1 40%', minWidth: '340px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            padding: '10px 14px', 
            borderRadius: '14px',
            boxShadow: 'var(--card-shadow)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            
            {/* Cart Header with Quick Tool Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 800 }}>
                <ShoppingCart color="var(--accent-color)" size={18} /> عەرەبانە
                {cart.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>({cart.length})</span>}
              </h2>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => setIsScaleModalOpen(true)}
                  title="تەرازوو و فرۆشتنی بە کێش (F3)"
                  style={{ 
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    background: 'rgba(2, 132, 199, 0.1)', 
                    color: '#0284c7', 
                    border: '1px solid rgba(2, 132, 199, 0.35)', 
                    fontWeight: 700, 
                    fontSize: '0.78rem', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                  }}
                >
                  <Scale size={13} /> تەرازوو (F3)
                </button>

                {allowCustomPrice && (
                  <button 
                    type="button" 
                    onClick={() => setIsQuickItemModalOpen(true)}
                    title="کاڵای دەستی بێ بارکۆد (F2)"
                    style={{ 
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      background: 'var(--warning-light)', 
                      color: '#b45309', 
                      border: '1px solid rgba(245, 158, 11, 0.3)', 
                      fontWeight: 700, 
                      fontSize: '0.78rem', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px' 
                    }}
                  >
                    <Zap size={13} /> دەستی (F2)
                  </button>
                )}

                {cart.length > 0 && allowClearCart && (
                  <button 
                    onClick={clearCart}
                    style={{ background: 'var(--danger-light)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}
                  >
                    <Trash2 size={12} /> سڕینەوە
                  </button>
                )}
              </div>
            </div>

            {/* Multi-Cart Tabs Bar (Quick Sell / Parallel Customers) */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
              {carts.map((c, idx) => {
                const isActive = activeCartIndex === idx;
                const itemCount = c.items.length;
                const hasItems = itemCount > 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCartIndex(idx)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid var(--accent-color)' : '1px solid transparent',
                      background: isActive 
                        ? 'var(--accent-color)' 
                        : (hasItems ? 'var(--warning-light)' : 'var(--bg-secondary)'),
                      color: isActive ? '#ffffff' : (hasItems ? 'var(--warning-color)' : 'var(--text-primary)'),
                      fontWeight: isActive ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontSize: '0.8rem',
                      boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
                    }}
                    title={`سویچ بکە بۆ ${c.label} (${c.shortcut})`}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                    <span style={{ 
                      flexShrink: 0,
                      fontSize: '0.7rem', 
                      padding: '1px 6px', 
                      borderRadius: '4px', 
                      background: isActive 
                        ? 'rgba(255, 255, 255, 0.25)' 
                        : (hasItems ? 'rgba(245, 158, 11, 0.25)' : 'var(--bg-tertiary)'),
                      color: isActive ? '#ffffff' : (hasItems ? '#b45309' : 'var(--text-secondary)'),
                      fontWeight: 700
                    }}>
                      {itemCount > 0 ? `${itemCount}` : c.shortcut}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Customer & Payment Mode Selection */}
            <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
              
              {/* Row 1: Full-Width Customer Selection + Add Customer Button */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCustomerId(val);
                    if (!val) {
                      setPaymentMode('CASH');
                      setSplitCashAmount('');
                    }
                  }}
                  style={{ 
                    flex: 1, 
                    minWidth: 0,
                    padding: '5px 8px', 
                    borderRadius: '6px', 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-primary)', 
                    fontSize: '0.8rem', 
                    outline: 'none',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  <option value="">کڕیاری گشتی (نەقد)...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} - قەرز: {Number(c.total_debt || 0).toLocaleString()} د.ع
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerModalOpen(true)}
                  style={{
                    flexShrink: 0,
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: 'rgba(37, 99, 235, 0.12)',
                    border: '1px solid rgba(37, 99, 235, 0.35)',
                    color: 'var(--primary-color)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    whiteSpace: 'nowrap'
                  }}
                  title="زیادکردنی خێرای کڕیاری نوێ"
                >
                  <Plus size={12} /> کڕیار
                </button>
              </div>

              {/* Row 2: Payment Mode Selector Tabs (CASH, DEBT, SPLIT) in 3-Column Equal Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('CASH');
                    setSplitCashAmount('');
                  }}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    padding: '5px 6px',
                    borderRadius: '6px',
                    border: paymentMode === 'CASH' ? '1px solid var(--success-color)' : '1px solid var(--border-color)',
                    background: paymentMode === 'CASH' ? 'var(--success-light)' : 'var(--bg-secondary)',
                    color: paymentMode === 'CASH' ? 'var(--success-color)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Banknote size={13} /> نەقد
                </button>

                {allowDebtSale ? (
                  <button
                    type="button"
                    disabled={!selectedCustomerId}
                    onClick={() => {
                      if (!selectedCustomerId) return;
                      setPaymentMode('DEBT');
                      setSplitCashAmount('');
                    }}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '5px 6px',
                      borderRadius: '6px',
                      border: paymentMode === 'DEBT' ? '1px solid var(--danger-color)' : '1px solid var(--border-color)',
                      background: paymentMode === 'DEBT' ? 'var(--danger-light)' : 'var(--bg-secondary)',
                      color: !selectedCustomerId ? 'var(--text-muted)' : (paymentMode === 'DEBT' ? 'var(--danger-color)' : 'var(--text-secondary)'),
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: !selectedCustomerId ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                    title={!selectedCustomerId ? 'تکایە سەرەتا کڕیار دیاریبکە' : ''}
                  >
                    <CreditCard size={13} /> قەرز
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={true}
                    title="بەڕێوەبەر فرۆشتن بە قەرزی بۆ کاشێر قفڵ کردووە"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '5px 6px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      opacity: 0.6
                    }}
                  >
                    <Lock size={12} /> قەرز
                  </button>
                )}

                {allowSplitPayment ? (
                  <button
                    type="button"
                    disabled={!selectedCustomerId}
                    onClick={() => {
                      if (!selectedCustomerId) return;
                      setPaymentMode('SPLIT');
                      if (!splitCashAmount) {
                        setSplitCashAmount(String(Math.round(grandTotal / 2)));
                      }
                    }}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '5px 6px',
                      borderRadius: '6px',
                      border: paymentMode === 'SPLIT' ? '1px solid var(--warning-color)' : '1px solid var(--border-color)',
                      background: paymentMode === 'SPLIT' ? 'var(--warning-light)' : 'var(--bg-secondary)',
                      color: !selectedCustomerId ? 'var(--text-muted)' : (paymentMode === 'SPLIT' ? '#b45309' : 'var(--text-secondary)'),
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: !selectedCustomerId ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                    title={!selectedCustomerId ? 'تکایە سەرەتا کڕیار دیاریبکە' : ''}
                  >
                    <Layers size={13} /> تێکەڵ
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={true}
                    title="بەڕێوەبەر پارەدانی تێکەڵی بۆ کاشێر قفڵ کردووە"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '5px 6px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      opacity: 0.6
                    }}
                  >
                    <Lock size={12} /> تێکەڵ
                  </button>
                )}
              </div>

              {selectedCustomer && (
                <div style={{ fontSize: '0.74rem', color: 'var(--warning-color)', fontWeight: 700, marginTop: '4px', textAlign: 'left' }}>
                  قەرزی پێشوو: {Number(selectedCustomer.total_debt || 0).toLocaleString()} د.ع
                </div>
              )}

              {/* Interactive Split Payment Calculator */}
              {paymentMode === 'SPLIT' && (
                <div style={{ marginTop: '6px', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--warning-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 700 }}>
                      نەقد (کاش):
                    </span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const half = Math.round(grandTotal / 2);
                          const roundedHalf = Math.round(half / 250) * 250;
                          setSplitCashAmount(String(roundedHalf));
                        }}
                        style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', background: 'var(--warning-light)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.4)', cursor: 'pointer', fontWeight: 700 }}
                      >
                        ٥٠٪
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitCashAmount(String(grandTotal))}
                        style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', background: 'var(--success-light)', color: 'var(--success-color)', border: '1px solid rgba(16, 185, 129, 0.4)', cursor: 'pointer', fontWeight: 700 }}
                      >
                        ١٠٠٪
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const current = Math.max(0, parseInt(splitCashAmount) || 0);
                        const nextVal = Math.max(0, current - 250);
                        setSplitCashAmount(nextVal === 0 ? '' : String(nextVal));
                      }}
                      title="-250"
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'var(--warning-light)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#b45309', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      <span dir="ltr" style={{ display: 'inline-block' }}>-250</span>
                    </button>

                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      step="250"
                      value={splitCashAmount}
                      placeholder="بڕی نەقد..."
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                      style={{ flex: 1, padding: '4px 6px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--success-color)', fontSize: '0.9rem', fontWeight: 800, textAlign: 'center', outline: 'none' }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const current = Math.max(0, parseInt(splitCashAmount) || 0);
                        const nextVal = Math.min(grandTotal, current + 250);
                        setSplitCashAmount(String(nextVal));
                      }}
                      title="+250"
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'var(--warning-light)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#b45309', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      <span dir="ltr" style={{ display: 'inline-block' }}>+250</span>
                    </button>
                  </div>

                  {/* Realtime Split Breakdown */}
                  <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--success-color)', fontWeight: 700 }}>نەقد: {effectiveCashPaid.toLocaleString()} د.ع</span>
                    <span style={{ color: 'var(--danger-color)', fontWeight: 700 }}>قەرز: {effectiveDebtAmount.toLocaleString()} د.ع</span>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Items List with Decimal & Multipliers */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '6px', paddingRight: '2px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '35px 10px', color: 'var(--text-muted)' }}>
                  <ShoppingCart size={40} style={{ opacity: 0.25, margin: '0 auto 10px auto' }} />
                  عەرەبانەی کڕین واڵایە.<br/>کاڵایەک سکان بکە یان لە خشتەکە هەڵیبژێرە.
                </div>
              ) : (
                cart.map(item => {
                  const pricing = getItemPricing(item);
                  const lineTotal = pricing.lineTotal;
                  const isKg = item.unit === 'کگم' || item.is_weighted;
                  const itemKey = item.cartKey || item.barcode;
                  return (
                    <div 
                      key={itemKey}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '16px',
                        background: item.unit_type === 'BOX' ? 'rgba(2, 132, 199, 0.08)' : (pricing.hasPromo ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-tertiary)'),
                        border: item.unit_type === 'BOX' ? '1.5px solid rgba(2, 132, 199, 0.35)' : (pricing.hasPromo ? '1.5px solid rgba(217, 119, 6, 0.35)' : '1px solid var(--border-color)'),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {item.name}
                            {item.is_custom && (
                              <span style={{ fontSize: '0.72rem', background: isKg ? 'rgba(2, 132, 199, 0.12)' : 'var(--warning-light)', color: isKg ? '#0284c7' : '#b45309', padding: '1px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                {isKg ? 'بە کێش' : 'دەستی'}
                              </span>
                            )}
                            {item.unit_type === 'BOX' && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.35)', padding: '1px 8px', borderRadius: '6px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Package size={11} /> کارتۆن ({item.units_per_box || 1} دانە)
                              </span>
                            )}
                            {pricing.hasPromo && item.unit_type !== 'BOX' && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.35)', padding: '1px 8px', borderRadius: '6px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Tag size={10} /> ئۆفەر
                              </span>
                            )}
                          </div>

                          {/* Promotional Tiered Explanation */}
                          {pricing.hasPromo && item.unit_type !== 'BOX' ? (
                            <div style={{ marginTop: '4px' }}>
                              {pricing.regularQty > 0 ? (
                                <div style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>
                                  {pricing.promoQty} بە {pricing.promoPrice.toLocaleString()} د.ع (ئۆفەر) + {pricing.regularQty} بە {pricing.regularPrice.toLocaleString()} د.ع (ئاسایی)
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 600 }}>
                                  {pricing.promoPrice.toLocaleString()} دینار (ئۆفەر)
                                </div>
                              )}
                              {pricing.totalSavings > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--success-color)', fontWeight: 800, display: 'block', marginTop: '2px' }}>
                                  پاشەکەوت: {pricing.totalSavings.toLocaleString()} دینار
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {item.price.toLocaleString()} دینار بۆ هەر {item.unit || 'دانە'}
                              {item.unit_type === 'BOX' && (
                                <span style={{ color: '#0284c7', marginRight: '6px', fontWeight: 600 }}>
                                  (کۆگایی: {item.units_per_box || 1} دانە)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, color: item.unit_type === 'BOX' ? '#0284c7' : 'var(--accent-hover)', fontSize: '1.05rem' }}>
                            {lineTotal.toLocaleString()} دینار
                          </div>
                          {allowDeleteItem && (
                            <button 
                              onClick={() => removeFromCart(itemKey)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '2px', marginTop: '2px' }}
                              title="سڕینەوە"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper & Unit Switcher & Quick Multipliers */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        
                        {/* Stepper +/- */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '3px 4px', border: '1px solid var(--border-color)' }}>
                          <button 
                            type="button"
                            onClick={() => {
                              const step = isKg ? 0.25 : 1;
                              const targetQty = Math.round((Number(item.quantity) - step) * 1000) / 1000;
                              updateQuantity(itemKey, Math.max(0, targetQty));
                            }}
                            title={Number(item.quantity) <= (isKg ? 0.25 : 1) ? 'سڕینەوە لە سەبەتە (0)' : 'کەمکردنەوە'}
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '8px', 
                              background: Number(item.quantity) <= (isKg ? 0.25 : 1) ? 'var(--danger-light)' : 'var(--bg-tertiary)', 
                              color: Number(item.quantity) <= (isKg ? 0.25 : 1) ? 'var(--danger-color)' : 'var(--text-primary)', 
                              border: Number(item.quantity) <= (isKg ? 0.25 : 1) ? '1px solid rgba(239, 68, 68, 0.4)' : 'none', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Minus size={15} />
                          </button>
                          
                          <input 
                            type="number" 
                            step={isKg ? '0.05' : '1'}
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(itemKey, e.target.value)}
                            style={{ width: '55px', textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.98rem', outline: 'none', padding: 0 }}
                          />

                          <button 
                            type="button"
                            onClick={() => {
                              const step = isKg ? 0.25 : 1;
                              const targetQty = Math.round((Number(item.quantity) + step) * 1000) / 1000;
                              updateQuantity(itemKey, targetQty);
                            }}
                            title="زیادکردن"
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '8px', 
                              background: 'var(--bg-tertiary)', 
                              color: 'var(--text-primary)', 
                              border: 'none', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Plus size={15} />
                          </button>
                        </div>

                        {/* Unit Switcher: دانە vs کارتۆن */}
                        {(item.units_per_box > 1 || item.wholesale_price > 0 || item.unit_type === 'BOX') && (
                          <div style={{ display: 'inline-flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
                            <button
                              type="button"
                              onClick={() => setItemUnitType(itemKey, 'PIECE')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: item.unit_type !== 'BOX' ? 'var(--primary-color)' : 'transparent',
                                color: item.unit_type !== 'BOX' ? '#ffffff' : 'var(--text-secondary)'
                              }}
                            >
                              دانە
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemUnitType(itemKey, 'BOX')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: item.unit_type === 'BOX' ? '#0284c7' : 'transparent',
                                color: item.unit_type === 'BOX' ? '#ffffff' : 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Package size={11} /> کارتۆن ({item.units_per_box || 1})
                            </button>
                          </div>
                        )}

                        {/* Quick Presets Buttons with 0 to Clear easily */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          {allowDeleteItem && (
                            <button
                              type="button"
                              onClick={() => removeFromCart(itemKey)}
                              title="سڕینەوەی خێرا لە سەبەتە (0)"
                              style={{
                                padding: '5px 9px',
                                borderRadius: '8px',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                background: 'var(--danger-light)',
                                color: 'var(--danger-color)',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Trash2 size={11} /> 0
                            </button>
                          )}

                          {(isKg ? [0.25, 0.5, 1, 2] : [1, 2, 5, 10, 20]).map(q => (
                            <button
                              type="button"
                              key={q}
                              onClick={() => updateQuantity(itemKey, q)}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '8px',
                                border: Number(item.quantity) === q ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                background: Number(item.quantity) === q ? 'var(--primary-color)' : 'var(--bg-secondary)',
                                color: Number(item.quantity) === q ? '#ffffff' : 'var(--text-secondary)',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {q} {isKg ? 'کگم' : ''}
                            </button>
                          ))}
                        </div>

                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Discount Row */}
            {!allowManualDiscount ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>
                <Lock size={14} color="#f59e0b" />
                <span>داشکاندنی دەستی لەلایەن بەڕێوەبەرەوە قفڵ کراوە</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '6px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#0284c7', fontWeight: 700 }}>
                  <Percent size={13} />
                  <button
                    type="button"
                    onClick={() => setDiscountType(discountType === 'AMOUNT' ? 'PERCENT' : 'AMOUNT')}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid rgba(2, 132, 199, 0.35)',
                      background: 'rgba(2, 132, 199, 0.1)',
                      color: '#0284c7',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {discountType === 'AMOUNT' ? 'دینار' : '%'}
                  </button>
                </div>

                {/* Stepper -250 / -5% */}
                <button
                  type="button"
                  onClick={() => {
                    if (discountType === 'AMOUNT') {
                      const current = Math.max(0, parseInt(discountValue) || 0);
                      const nextVal = Math.max(0, current - 250);
                      setDiscountValue(nextVal === 0 ? '' : String(nextVal));
                    } else {
                      const current = Math.max(0, parseInt(discountValue) || 0);
                      const nextVal = Math.max(0, current - 5);
                      setDiscountValue(nextVal === 0 ? '' : String(nextVal));
                    }
                  }}
                  title={discountType === 'AMOUNT' ? 'کەمکردنەوە بە ٢٥٠ دینار' : 'کەمکردنەوە بە ٥٪'}
                  style={{
                    padding: '3px 7px',
                    borderRadius: '6px',
                    background: 'var(--danger-light)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-color)',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <span dir="ltr" style={{ display: 'inline-block' }}>{discountType === 'AMOUNT' ? '-250' : '-5%'}</span>
                </button>

                <input 
                  ref={discountInputRef}
                  type="number"
                  min="0"
                  max={discountType === 'PERCENT' ? "100" : (subtotal > 0 ? subtotal : undefined)}
                  step={discountType === 'AMOUNT' ? '250' : '1'}
                  placeholder={discountType === 'PERCENT' ? 'داشکاندن (%):' : 'داشکاندن (د.ع):'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '4px 6px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', outline: 'none' }}
                />

                {/* Stepper +250 / +5% */}
                <button
                  type="button"
                  onClick={() => {
                    if (discountType === 'AMOUNT') {
                      const current = Math.max(0, parseInt(discountValue) || 0);
                      const nextVal = subtotal > 0 ? Math.min(subtotal, current + 250) : current + 250;
                      setDiscountValue(String(nextVal));
                    } else {
                      const current = Math.max(0, parseInt(discountValue) || 0);
                      const nextVal = Math.min(100, current + 5);
                      setDiscountValue(String(nextVal));
                    }
                  }}
                  title={discountType === 'AMOUNT' ? 'زیادکردن بە ٢٥٠ دینار' : 'زیادکردن بە ٥٪'}
                  style={{
                    padding: '3px 7px',
                    borderRadius: '6px',
                    background: 'rgba(2, 132, 199, 0.1)',
                    border: '1px solid rgba(2, 132, 199, 0.35)',
                    color: '#0284c7',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <span dir="ltr" style={{ display: 'inline-block' }}>{discountType === 'AMOUNT' ? '+250' : '+5%'}</span>
                </button>

                {calculatedDiscount > 0 && (
                  <span style={{ color: 'var(--danger-color)', fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    -{calculatedDiscount.toLocaleString()} د.ع
                  </span>
                )}
              </div>
            )}

            {/* Cart Footer: Totals & Checkout Button */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', flexShrink: 0 }}>
              
              {/* Subtotal & Discount Breakdown */}
              {(totalPromotionalSavings > 0 || calculatedDiscount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  <span>سەرەتایی: {subtotal.toLocaleString()} د.ع</span>
                  {totalPromotionalSavings > 0 && (
                    <span style={{ color: '#d97706', fontWeight: 700 }}>ئۆفەر: -{totalPromotionalSavings.toLocaleString()} د.ع</span>
                  )}
                  {calculatedDiscount > 0 && (
                    <span style={{ color: 'var(--danger-color)', fontWeight: 700 }}>داشکاندن: -{calculatedDiscount.toLocaleString()} د.ع</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی گشتی:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: paymentMode === 'DEBT' ? 'var(--danger-color)' : (paymentMode === 'SPLIT' ? 'var(--warning-color)' : 'var(--accent-hover)') }}>
                  {grandTotal.toLocaleString()} دینار
                </span>
              </div>

              {paymentMode === 'DEBT' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '4px 8px', background: 'var(--danger-light)', borderRadius: '6px', color: 'var(--danger-color)', fontSize: '0.78rem', marginBottom: '6px', fontWeight: 700, border: '1px solid rgba(220, 38, 38, 0.25)' }}>
                  <AlertCircle size={14} />
                  <span>دەچێتە سەر قەرزی: <strong>{selectedCustomer?.name}</strong></span>
                </div>
              )}

              {/* Auto-Print Preference Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', marginBottom: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)', userSelect: 'none', fontWeight: 600 }}>
                  <input 
                    type="checkbox" 
                    checked={autoPrint}
                    onChange={(e) => {
                      setAutoPrint(e.target.checked);
                      localStorage.setItem('pos_auto_print', e.target.checked ? 'true' : 'false');
                    }}
                    style={{ width: '14px', height: '14px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                  />
                  <span>چاپی خۆکاری پسووڵە</span>
                </label>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: autoPrint ? 'var(--success-color)' : 'var(--text-muted)' }}>
                  {autoPrint ? 'چالاکە' : 'ناچالاکە'}
                </span>
              </div>

              {/* Dual Action Buttons: Fast Sale vs Sale & Print */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  onClick={() => handleCheckout(false)}
                  disabled={isCheckingOut || cart.length === 0}
                  style={{
                    minWidth: 0,
                    padding: '9px 8px',
                    borderRadius: '8px',
                    background: cart.length === 0 ? 'var(--bg-tertiary)' : 'var(--primary-color)',
                    color: cart.length === 0 ? 'var(--text-muted)' : '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Zap size={15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isCheckingOut ? '...' : 'فرۆشتن بێ چاپ'}
                  </span>
                </button>

                <button
                  onClick={() => handleCheckout(true)}
                  disabled={isCheckingOut || cart.length === 0}
                  style={{
                    minWidth: 0,
                    padding: '9px 8px',
                    borderRadius: '8px',
                    background: cart.length === 0 
                      ? 'var(--bg-tertiary)' 
                      : (paymentMode === 'DEBT' ? 'var(--danger-color)' : (paymentMode === 'SPLIT' ? 'var(--warning-color)' : 'var(--success-color)')),
                    color: cart.length === 0 ? 'var(--text-muted)' : '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Printer size={15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isCheckingOut ? '...' : 'پارەدان و چاپ (F9)'}
                  </span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Hidden Thermal Receipt Container (Targeted by @media print) */}
      {printedReceipt && (
        <div id="cashier-thermal-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>
          <div className="receipt-divider"></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ژمارەی پسووڵە:</span>
            <span>#{printedReceipt.saleId}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>کڕیار:</span>
            <span>{printedReceipt.customerName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>بەروار:</span>
            <span>{printedReceipt.date}</span>
          </div>

          <div className="receipt-divider"></div>

          {/* Items */}
          <div style={{ margin: '4px 0' }}>
            {printedReceipt.items.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
                <span>{it.name} x {it.quantity} {it.unit}</span>
                <span>{it.total.toLocaleString()} دینار</span>
              </div>
            ))}
          </div>

          <div className="receipt-divider"></div>

          {printedReceipt.promotionalSavings > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#d97706', fontWeight: 'bold' }}>
              <span>پاشەکەوتی ئۆفەرەکان:</span>
              <span>-{printedReceipt.promotionalSavings.toLocaleString()} دینار</span>
            </div>
          )}

          {printedReceipt.discount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>کۆی سەرەتایی:</span>
                <span>{printedReceipt.subtotal.toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#333' }}>
                <span>داشکاندنی پسووڵە:</span>
                <span>-{printedReceipt.discount.toLocaleString()} دینار</span>
              </div>
              <div className="receipt-divider"></div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold' }}>
            <span>کۆی گشتی:</span>
            <span>{printedReceipt.total.toLocaleString()} دینار</span>
          </div>

          {printedReceipt.isSplit ? (
            <div style={{ margin: '4px 0', padding: '4px 0', borderTop: '1px dashed #000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
                <span>شێوازی پارەدان:</span>
                <span>فرە-جۆر (تێکەڵ)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>دراو بە نەقد:</span>
                <span>{Number(printedReceipt.paidAmount || 0).toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
                <span>ماوە بە قەرز:</span>
                <span>{Number(printedReceipt.debtAmount || 0).toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                <span>خاوەن قەرز:</span>
                <span>{printedReceipt.customerName}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px' }}>
              <span>شێوازی پارەدان:</span>
              <span>{printedReceipt.isDebt ? `قەرز (${printedReceipt.customerName})` : 'نەقد'}</span>
            </div>
          )}

          <div className="receipt-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>سوپاس بۆ سەردانەکەتان</div>
        </div>
      )}

      {/* Quick Custom Item Modal (F2) */}
      {isQuickItemModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsQuickItemModalOpen(false)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                <Zap color="#f59e0b" size={22} /> فرۆشتنی کاڵای دەستی / خێرا (F2)
              </h2>
              <button onClick={() => setIsQuickItemModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16}/>
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              بۆ ئەو کاڵایانەی بێ بارکۆدن یان لە سیستەم تۆمار نەکراون، نرخ بنووسە و ڕاستەوخۆ بیخەرە ناو عەرەبانە.
            </p>

            <form onSubmit={handleAddQuickCustomItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>ناوی کاڵا (ئارەزوومەندانە)</label>
                <input 
                  type="text" 
                  placeholder="کاڵای دەستی / گشتی..."
                  value={quickItemName}
                  onChange={(e) => setQuickItemName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--success-color)', fontWeight: 700, fontSize: '0.84rem' }}>
                  نرخی فرۆشتن (دینار) <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(quickItemPrice) || 0);
                      const next = Math.max(0, cur - 250);
                      setQuickItemPrice(next === 0 ? '' : String(next));
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>-250</span>
                  </button>
                  <input 
                    type="number" 
                    step="250"
                    min="0"
                    required
                    autoFocus
                    placeholder="بۆ نموونە: ٢٥٠٠"
                    value={quickItemPrice}
                    onChange={(e) => setQuickItemPrice(e.target.value)}
                    style={{ flex: '1 1 120px', minWidth: '110px', padding: '10px 12px', borderRadius: '10px', background: 'var(--success-light)', border: '1.5px solid rgba(16, 185, 129, 0.4)', color: 'var(--success-color)', fontWeight: 800, fontSize: '1.15rem', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(quickItemPrice) || 0);
                      setQuickItemPrice(String(cur + 250));
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>+250</span>
                  </button>
                </div>
                {/* Fast Dinar Presets */}
                <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {[250, 500, 1000, 2000, 3000, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setQuickItemPrice(String(amt))}
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>بڕ (دانە)</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input 
                    type="number" 
                    min="1"
                    value={quickItemQty}
                    onChange={(e) => setQuickItemQty(e.target.value)}
                    style={{ width: '70px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                    {[1, 2, 3, 5, 10].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuickItemQty(String(cnt))}
                        style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  style={{ flex: 1, minWidth: '130px', padding: '12px', borderRadius: '10px', background: 'var(--success-color)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  زیادکردن بۆ سەبەتە
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickItemModalOpen(false)}
                  style={{ padding: '12px 18px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scale / Weighted Item Modal (F3) */}
      {isScaleModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsScaleModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                <Scale color="#0284c7" size={22} /> تەرازوو و فرۆشتنی بە کێش (F3)
              </h2>
              <button onClick={() => setIsScaleModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16}/>
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              دیاریکردنی نرخی کیلۆ و کێش (بە کیلۆگرام یان گرام) بۆ ئەژمارکردنی خێرای سەوزە و میوە.
            </p>

            <form onSubmit={handleAddScaleItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Optional: Pick from existing products */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>هەڵبژاردن لە کاڵاکان (ئارەزوومەندانە):</label>
                <select 
                  value={scaleSelectedProductId}
                  onChange={(e) => handleSelectProductForScale(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                >
                  <option value="">یان بە دەستی بنووسە...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - نرخی تاک: {Number(p.selling_price).toLocaleString()} دینار
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>ناوی کاڵا / سەوزە / میوە <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="بۆ نموونە: تەماتە، خەیار، پەتاتە..."
                  value={scaleItemName}
                  onChange={(e) => setScaleItemName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--success-color)', fontWeight: 700, fontSize: '0.84rem' }}>
                  نرخی یەک کیلۆ (دینار) <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(scalePricePerKg) || 0);
                      const next = Math.max(0, cur - 250);
                      setScalePricePerKg(next === 0 ? '' : String(next));
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>-250</span>
                  </button>
                  <input 
                    type="number" 
                    step="250"
                    min="0"
                    required
                    placeholder="بۆ نموونە: ١٠٠٠"
                    value={scalePricePerKg}
                    onChange={(e) => setScalePricePerKg(e.target.value)}
                    style={{ flex: '1 1 120px', minWidth: '110px', padding: '10px 12px', borderRadius: '10px', background: 'var(--success-light)', border: '1.5px solid rgba(16, 185, 129, 0.4)', color: 'var(--success-color)', fontWeight: 800, fontSize: '1.15rem', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(scalePricePerKg) || 0);
                      setScalePricePerKg(String(cur + 250));
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>+250</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#0284c7', fontWeight: 700, fontSize: '0.84rem' }}>
                  کێش (بە کیلۆگرام - کگم) <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    step="0.001"
                    min="0.001"
                    required
                    value={scaleWeight}
                    onChange={(e) => setScaleWeight(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.08)', border: '1.5px solid rgba(2, 132, 199, 0.4)', color: '#0284c7', fontWeight: 800, fontSize: '1.15rem', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 800, flexShrink: 0 }}>کگم</span>
                </div>

                {/* Quick Weight Presets */}
                <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '٢٥٠ گرام', val: '0.250' },
                    { label: '٥٠٠ گرام (نیو کگم)', val: '0.500' },
                    { label: '٧٥٠ گرام', val: '0.750' },
                    { label: '١ کگم', val: '1.000' },
                    { label: '١.٥ کگم', val: '1.500' },
                    { label: '٢ کگم', val: '2.000' },
                  ].map(w => (
                    <button
                      key={w.val}
                      type="button"
                      onClick={() => setScaleWeight(w.val)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: scaleWeight === w.val ? '1px solid #0284c7' : '1px solid var(--border-color)',
                        background: scaleWeight === w.val ? '#0284c7' : 'var(--bg-tertiary)',
                        color: scaleWeight === w.val ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Price Calculator Preview */}
              {scalePricePerKg && scaleWeight && (
                <div style={{ background: 'var(--success-light)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>کۆی پارەی کێشەکە: </span>
                  <span style={{ color: 'var(--success-color)', fontWeight: 900, fontSize: '1.25rem' }}>
                    {Math.round((parseFloat(scalePricePerKg) || 0) * (parseFloat(scaleWeight) || 0)).toLocaleString()} دینار
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.96rem', cursor: 'pointer' }}
                >
                  خستنە ناو سەبەتە
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsScaleModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '12px 18px', borderRadius: '12px', fontWeight: 700 }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {isQuickCustomerModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsQuickCustomerModalOpen(false)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                <User color="var(--primary-color)" size={22} /> زیادکردنی خێرای کڕیار
              </h2>
              <button onClick={() => setIsQuickCustomerModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16}/>
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              بۆ ئەوەی کڕیار بە قەرز بکڕێت بێ ئەوەی لە کاشێر بچیتە دەرەوە، ناوی کڕیار بنووسە.
            </p>

            <form onSubmit={handleSaveQuickCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>
                  ناوی کڕیار <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  placeholder="ناوی تەواوی کڕیار..."
                  value={quickCustomerName}
                  onChange={(e) => setQuickCustomerName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>
                  ژمارەی مۆبایل (ئارەزوومەندانە)
                </label>
                <input 
                  type="text" 
                  placeholder="0750 000 0000"
                  value={quickCustomerPhone}
                  onChange={(e) => setQuickCustomerPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', direction: 'ltr', textAlign: 'right' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>
                  قەرزی سەرەتایی (دینار)
                </label>
                <input 
                  type="number" 
                  step="250"
                  min="0"
                  placeholder="0"
                  value={quickCustomerDebt}
                  onChange={(e) => setQuickCustomerDebt(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  disabled={isSavingCustomer}
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.96rem', cursor: isSavingCustomer ? 'not-allowed' : 'pointer' }}
                >
                  {isSavingCustomer ? 'خەریکە پاشەکەوت دەکرێت...' : 'زیادکردن و دیاریکردن'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsQuickCustomerModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '12px 18px', borderRadius: '12px', fontWeight: 700 }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fast Uncatalogued Barcode Price Entry Modal */}
      {isUncataloguedModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsUncataloguedModalOpen(false)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: '#b45309', fontWeight: 800 }}>
                <AlertCircle color="#d97706" size={22} /> بارکۆدی تۆمارنەکراو
              </h2>
              <button onClick={() => setIsUncataloguedModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16}/>
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              ئەم بارکۆدە <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{uncataloguedBarcode}</strong> پێشتر تۆمار نەکراوە. تەنها نرخ دیاریبکە بۆ فرۆشتنی دەستبەجێ!
            </p>

            <form onSubmit={handleAddUncataloguedItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.84rem' }}>
                  ناوی کاڵا
                </label>
                <input 
                  type="text" 
                  value={uncataloguedName}
                  onChange={(e) => setUncataloguedName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--success-color)', fontWeight: 700, fontSize: '0.84rem' }}>
                  نرخی فرۆشتن (دینار) <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(uncataloguedPrice) || 0);
                      const next = Math.max(0, cur - 250);
                      setUncataloguedPrice(next === 0 ? '' : String(next));
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>-250</span>
                  </button>
                  <input 
                    type="number" 
                    step="250"
                    min="0"
                    required
                    autoFocus
                    placeholder="بۆ نموونە: ١٠٠٠"
                    value={uncataloguedPrice}
                    onChange={(e) => setUncataloguedPrice(e.target.value)}
                    style={{ flex: '1 1 120px', minWidth: '110px', padding: '10px 12px', borderRadius: '10px', background: 'var(--success-light)', border: '1.5px solid rgba(16, 185, 129, 0.4)', color: 'var(--success-color)', fontWeight: 800, fontSize: '1.15rem', textAlign: 'center', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(uncataloguedPrice) || 0);
                      setUncataloguedPrice(String(cur + 250));
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>+250</span>
                  </button>
                </div>

                {/* Quick Dinar Presets */}
                <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {[250, 500, 750, 1000, 1500, 2000, 2500, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setUncataloguedPrice(String(amt))}
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="checkbox" 
                  id="saveToProductCatalog"
                  checked={saveToProductCatalog}
                  onChange={(e) => setSaveToProductCatalog(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                />
                <label htmlFor="saveToProductCatalog" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  ئەم کاڵایە لە لیستی بەرهەمەکانیشدا تۆمار بکرێت بۆ جارەکانی داهاتوو
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  className="btn-success"
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.96rem' }}
                >
                  خستنە ناو سەبەتە
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsUncataloguedModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '12px 18px', borderRadius: '12px', fontWeight: 700 }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Cashier;