import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { normalizeBarcode } from '../utils/barcodeNormalizer';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import { Scale, Search, X as XIcon, Check, ShoppingCart, Tag, RotateCcw } from 'lucide-react';
import BarcodeSVG from '../components/BarcodeSVG';
import './Dashboard.css';

const Cashier = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, canCashier, logout } = useAuth();

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
      const target = prevCarts[activeCartIndex] || prevCarts[0];
      const newTarget = typeof updater === 'function' ? updater({ ...target }) : { ...target, ...updater };
      return prevCarts.map((c, idx) => idx === activeCartIndex ? newTarget : c);
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
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const splitCashInputRef = useRef(null);


  // Scale / Weighted Items State
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [scaleItemName, setScaleItemName] = useState('');
  const [scalePricePerKg, setScalePricePerKg] = useState('');
  const [scaleWeight, setScaleWeight] = useState('');
  const [scaleAmount, setScaleAmount] = useState('');
  const [scaleUnit, setScaleUnit] = useState('G'); // Always 'G' (Grams)
  const [scaleSelectedProductId, setScaleSelectedProductId] = useState('');
  const [isScaleSearchOpen, setIsScaleSearchOpen] = useState(false);
  const scaleDropdownRef = useRef(null);

  // Click outside to close Scale Product Searchable Dropdown
  useEffect(() => {
    const handleScaleClickOutside = (event) => {
      if (scaleDropdownRef.current && !scaleDropdownRef.current.contains(event.target)) {
        setIsScaleSearchOpen(false);
      }
    };
    if (isScaleSearchOpen) {
      document.addEventListener('mousedown', handleScaleClickOutside);
      document.addEventListener('touchstart', handleScaleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleScaleClickOutside);
      document.removeEventListener('touchstart', handleScaleClickOutside);
    };
  }, [isScaleSearchOpen]);

  // Invoice-based Return Modal State (سادە، بێ وەسڵ، لەسەر هەمان شاشە بە پێی پسووڵە)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnSaleIdInput, setReturnSaleIdInput] = useState('');
  const [returnSearchedSale, setReturnSearchedSale] = useState(null);
  const [returnSelectedSaleItem, setReturnSelectedSaleItem] = useState(null);
  const [returnQtyInput, setReturnQtyInput] = useState(1);
  const [returnRecentSales, setReturnRecentSales] = useState([]);
  const [isInvoiceDropdownOpen, setIsInvoiceDropdownOpen] = useState(false);
  const [isSearchingReturnSale, setIsSearchingReturnSale] = useState(false);
  const [isExecutingReturn, setIsExecutingReturn] = useState(false);
  const [returnModalNotice, setReturnModalNotice] = useState(null);
  const returnInputRef = useRef(null);
  const returnDropdownRef = useRef(null);

  // Click outside to close Return Invoice Search Dropdown
  useEffect(() => {
    const handleReturnClickOutside = (event) => {
      if (returnDropdownRef.current && !returnDropdownRef.current.contains(event.target)) {
        setIsInvoiceDropdownOpen(false);
      }
    };
    if (isInvoiceDropdownOpen) {
      document.addEventListener('mousedown', handleReturnClickOutside);
      document.addEventListener('touchstart', handleReturnClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleReturnClickOutside);
      document.removeEventListener('touchstart', handleReturnClickOutside);
    };
  }, [isInvoiceDropdownOpen]);

  // Quick Inline Customer Modal State
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerDebt, setQuickCustomerDebt] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Searchable Customer Combobox State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerSearchRef = useRef(null);
  const customerInputRef = useRef(null);

  // Fast Uncatalogued Barcode Modal State
  const [isUncataloguedModalOpen, setIsUncataloguedModalOpen] = useState(false);
  const [uncataloguedBarcode, setUncataloguedBarcode] = useState('');
  const [uncataloguedName, setUncataloguedName] = useState('');
  const [uncataloguedPrice, setUncataloguedPrice] = useState('');
  const [saveToProductCatalog, setSaveToProductCatalog] = useState(true);

  // Cash Received & Change Due State
  const [cashReceived, setCashReceived] = useState('');

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Receipt Print State
  const [printedReceipt, setPrintedReceipt] = useState(null);
  const [autoPrint, setAutoPrint] = useState(() => {
    return localStorage.getItem('pos_auto_print') === 'true';
  });

  // Recent Sales Modal State
  const [isRecentSalesOpen, setIsRecentSalesOpen] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [isLoadingRecentSales, setIsLoadingRecentSales] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [expandedSaleDetails, setExpandedSaleDetails] = useState({});
  const [isReprintingSaleId, setIsReprintingSaleId] = useState(null);

  // Quick Return in Cashier State
  const [selectedCartKey, setSelectedCartKey] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم';
  const storePhone = localStorage.getItem('pos_store_phone') || '';

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
    setTimeout(() => window.print(), 300);
  };

  // Open Recent Sales Modal (Fetches Latest 10 Completed Sales)
  const handleOpenRecentSales = async () => {
    setIsRecentSalesOpen(true);
    setIsLoadingRecentSales(true);
    setExpandedSaleId(null);
    try {
      const res = await axios.get('http://localhost:3001/api/sales');
      if (res.data.status === 'SUCCESS') {
        setRecentSales((res.data.data || []).slice(0, 10));
      }
    } catch (err) {
      console.error('Failed to load recent sales:', err);
    } finally {
      setIsLoadingRecentSales(false);
    }
  };

  // Toggle Sale Items Breakdown
  const handleToggleSaleDetails = async (saleId) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      return;
    }
    setExpandedSaleId(saleId);
    if (!expandedSaleDetails[saleId]) {
      try {
        const res = await axios.get(`http://localhost:3001/api/sales/${saleId}`);
        if (res.data.status === 'SUCCESS') {
          setExpandedSaleDetails(prev => ({ ...prev, [saleId]: res.data.data.items || [] }));
        }
      } catch (err) {
        console.error('Failed to load sale items:', err);
      }
    }
  };

  // 1-Click Direct Reprint of Specific Past Sale
  const handleReprintRecentSale = async (saleId) => {
    setIsReprintingSaleId(saleId);
    try {
      const res = await axios.get(`http://localhost:3001/api/sales/${saleId}`);
      if (res.data.status === 'SUCCESS') {
        const sale = res.data.data;
        const receiptData = {
          saleId: sale.id,
          date: formatDateTime(sale.created_at, { twelveHour: true }),
          cashierName: sale.cashier_name || currentUser?.full_name || currentUser?.username || 'کاشێر',
          customerName: sale.customer_name || 'کڕیاری گشتی',
          customerPhone: sale.customer_phone || '',
          paymentMethod: sale.payment_method,
          paidAmount: Number(sale.paid_amount || sale.total_amount),
          debtAmount: Number(sale.pay_later_amount || 0),
          isDebt: sale.payment_method === 'DEBT',
          isSplit: sale.payment_method === 'SPLIT',
          tenderedAmount: null,
          changeDue: null,
          subtotal: Number(sale.subtotal_amount || sale.total_amount),
          promotionalSavings: 0,
          discount: Number(sale.discount_amount || 0),
          total: Number(sale.total_amount),
          items: (sale.items || []).map(it => ({
            name: it.product_name,
            quantity: it.quantity,
            price: Number(it.price_per_unit || it.price || 0),
            total: Number(it.total_price || (it.quantity * (it.price_per_unit || it.price || 0))),
            unit: it.unit || 'دانە',
            unit_type: it.unit_type || 'PIECE'
          }))
        };
        setPrintedReceipt(receiptData);
        if (window.require) {
          try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('print-receipt', receiptData);
          } catch (_) {}
        }
        setTimeout(() => window.print(), 300);
      }
    } catch (err) {
      alert('هەڵەیەک ڕوویدا لە کاتی ئامادەکردنی پسووڵە بۆ چاپ');
    } finally {
      setIsReprintingSaleId(null);
    }
  };

  // Global Keyboard Shortcuts (F1, F2, F3, F4, F6, F7, F8, F9, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleOpenReturnModal();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleOpenScaleModal();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (!allowManualDiscount) {
          alert('داشکاندنی دەستی لەلایەن بەڕێوەبەرەوە بۆ کاشێر قفڵ کراوە');
          return;
        }
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
        setIsRecentSalesOpen(false);
        setIsScaleModalOpen(false);
        setIsReturnModalOpen(false);
        setIsQuickCustomerModalOpen(false);
        setIsUncataloguedModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Cart Add & Update
  const addToCart = (product, addQty = 1, unitType = 'PIECE') => {
    const isBox = unitType === 'BOX';
    // Active FIFO batch multiplier: NEVER fall back to product.units_per_box
    const unitsPerBox = Math.max(1, parseFloat(product.active_units_per_box) || 1);
    const addingUnits = isBox ? (Number(addQty) * unitsPerBox) : Number(addQty);
    const availableStock = Number(product.stock) || 0;

    // Strict Stock Enforcement (Permanently active: cannot add or exceed available stock)
    if (!product.is_weighted) {
      if (availableStock <= 0) {
        toast.error(`ئەم کاڵایە (${product.name}) لە کۆگا نەماوە!`);
        return;
      }

      const currentCartUnits = cart.reduce((sum, it) => {
        if (it.id === product.id) {
          const itUnitsPerBox = it.unit_type === 'BOX' ? (Number(it.units_per_box) || 1) : 1;
          return sum + (Number(it.quantity) * itUnitsPerBox);
        }
        return sum;
      }, 0);

      const totalRequested = currentCartUnits + addingUnits;
      if (totalRequested > availableStock) {
        const remainingCanAdd = availableStock - currentCartUnits;
        if (remainingCanAdd <= 0) {
          toast.error(`ناتوانیت لەم کاڵایە زیاتر زیاد بکەیت! هەموو بڕی بەردەست لە سەبەتەدایە.`);
        } else {
          toast.error(`ناتوانیت لە بڕی بەردەستی مەغزەن زیاتر زیاد بکەیت!`);
        }
        return;
      }
    }

    setCart(prevCart => {
      const singlePrice = Number(product.active_batch_selling_price || product.selling_price) || 0;
      const boxPrice = Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : Math.round(singlePrice * unitsPerBox);
      const effectivePrice = isBox ? boxPrice : singlePrice;
      const cartKey = `${product.id}_${unitType}`;

      const existingIdx = prevCart.findIndex(item => (item.cartKey === cartKey) || (item.id === product.id && (item.unit_type || 'PIECE') === unitType));

      if (existingIdx >= 0) {
        const currentItem = prevCart[existingIdx];
        const newQty = Math.round((Number(currentItem.quantity) + Number(addQty)) * 1000) / 1000;
        return prevCart.map((item, idx) => 
          idx === existingIdx ? { ...item, quantity: Math.max(0.001, newQty) } : item
        );
      } else {
        const newItem = {
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
        };
        return [...prevCart, newItem];
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

    const targetItem = cart.find(item => item.cartKey === key || item.barcode === key);

    // Strict Stock Enforcement (Permanently active)
    if (targetItem && !targetItem.is_weighted) {
      const prod = products.find(p => p.id === targetItem.id);
      const availableStock = prod ? (Number(prod.stock) || 0) : (Number(targetItem.stock) || 0);
      const unitsPerBox = targetItem.unit_type === 'BOX' ? (Number(targetItem.units_per_box) || 1) : 1;
      const requestedUnits = qty * unitsPerBox;

      // Count units in other cart lines for the same product
      const otherUnits = cart.reduce((sum, it) => {
        if (it.id === targetItem.id && it !== targetItem) {
          const itMult = it.unit_type === 'BOX' ? (Number(it.units_per_box) || 1) : 1;
          return sum + (Number(it.quantity) * itMult);
        }
        return sum;
      }, 0);

      if (requestedUnits + otherUnits > availableStock) {
        toast.error(`ناتوانیت لە بڕی بەردەستی مەغزەن زیاتر زیاد بکەیت!`);
        return;
      }
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

  const updateItemPrice = (key, newPrice) => {
    if (!allowCustomPrice) {
      alert('بەڕێوەبەر دەستکاریکردنی نرخی فرۆشتنی بۆ کاشێر قفڵ کردووە');
      return;
    }
    const parsed = Math.max(0, parseInt(newPrice) || 0);
    if (parsed <= 0) return;
    setCart(prev => prev.map(item => (item.cartKey === key || item.barcode === key) ? { ...item, price: parsed, has_custom_price: true } : item));
  };

  const clearCart = () => {
    if (!allowClearCart) {
      alert('بەڕێوەبەر بەتاڵکردنەوەی گشتی سەبەتەی قفڵ کردووە');
      return;
    }
    setCashReceived('');
    updateActiveCart({
      items: [],
      customerId: '',
      paymentMode: 'CASH',
      splitCashAmount: '',
      isDebtSale: false,
      discountValue: ''
    });
  };

  // Add Scale / Weighted Item (سەوزە و میوە بە کێش)
  // Filtered Products for Scale Search Combobox (تەنیا ئەو کاڵایانەی بە کێش / تەرازوو دەفرۆشرێن)
  const filteredScaleProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    // Prioritize products marked as weighted (is_weighted = 1 or unit = 'کگم')
    const weightedOnly = products.filter(p => Boolean(p.is_weighted) || p.unit === 'کگم');
    const sourceList = (weightedOnly.length > 0 && !scaleItemName.trim()) ? weightedOnly : products;
    if (!scaleItemName.trim()) return sourceList.slice(0, 15);
    return sourceList.filter(p => kurdishSearchMatch([p.name, p.barcode], scaleItemName)).slice(0, 15);
  }, [products, scaleItemName]);

  const handleOpenScaleModal = () => {
    setScaleItemName('');
    setScalePricePerKg('');
    setScaleWeight('');
    setScaleAmount('');
    setScaleUnit('G');
    setScaleSelectedProductId('');
    setIsScaleSearchOpen(false);
    setIsScaleModalOpen(true);
  };

  const handleSelectScaleProduct = (p) => {
    setScaleItemName(p.name);
    const pKg = parseFloat(p.selling_price) || 0;
    setScalePricePerKg(String(pKg));
    setScaleSelectedProductId(p.id);
    setIsScaleSearchOpen(false);

    if (pKg > 0) {
      if (scaleWeight && parseFloat(scaleWeight) > 0) {
        const rawW = parseFloat(scaleWeight);
        const wKg = rawW / 1000;
        setScaleAmount(String(Math.round(wKg * pKg)));
      } else if (scaleAmount && parseFloat(scaleAmount) > 0) {
        const amt = parseFloat(scaleAmount);
        const wKg = amt / pKg;
        setScaleWeight(String(Math.round(wKg * 1000)));
      } else {
        setScaleWeight('');
        setScaleAmount('');
      }
    }
  };

  const handleScaleAmountChange = (val) => {
    setScaleAmount(val);
    const amt = parseFloat(val);
    const pKg = parseFloat(scalePricePerKg) || 0;
    if (!val || isNaN(amt) || amt <= 0) {
      setScaleWeight('');
      return;
    }
    if (pKg > 0) {
      const wKg = amt / pKg;
      setScaleWeight(String(Math.round(wKg * 1000)));
    }
  };

  const handleScaleWeightChange = (val) => {
    setScaleWeight(val);
    const w = parseFloat(val);
    const pKg = parseFloat(scalePricePerKg) || 0;
    if (!val || isNaN(w) || w <= 0) {
      setScaleAmount('');
      return;
    }
    if (pKg > 0) {
      const wKg = w / 1000;
      setScaleAmount(String(Math.round(wKg * pKg)));
    }
  };

  const handleScaleUnitToggle = (targetUnit) => {
    setScaleUnit(targetUnit || 'G');
  };

  const handleQuickWeightPreset = (presetVal) => {
    const pKg = parseFloat(scalePricePerKg) || 0;
    const grams = parseFloat(presetVal);
    setScaleUnit('G');
    setScaleWeight(String(grams));
    if (pKg > 0) {
      setScaleAmount(String(Math.round((grams / 1000) * pKg)));
    }
    setIsScaleSearchOpen(false);
  };

  const handleQuickAmountPreset = (amtPreset) => {
    const amt = parseFloat(amtPreset);
    setScaleAmount(String(amt));
    const pKg = parseFloat(scalePricePerKg) || 0;
    if (pKg > 0 && amt > 0) {
      const wKg = amt / pKg;
      setScaleWeight(String(Math.round(wKg * 1000)));
    }
    setIsScaleSearchOpen(false);
  };

  const handleAddScaleItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const pricePerKg = Math.max(0, parseInt(scalePricePerKg) || 0);
    const rawWeightInGrams = parseFloat(scaleWeight) || 0;
    const weightInKg = rawWeightInGrams / 1000;

    if (pricePerKg <= 0) {
      alert('تکایە سەرەتا کاڵایەک هەڵبژێرە کە نرخەکەی دیاریکراو بێت');
      return;
    }

    if (weightInKg <= 0) {
      alert('تکایە بڕی پارە یان کێشێکی دروست بنووسە');
      return;
    }

    const name = scaleItemName.trim() || 'کاڵا بە کێش / تەرازوو';
    const selectedProd = scaleSelectedProductId ? products.find(p => String(p.id) === String(scaleSelectedProductId)) : null;
    const isCustomScale = !selectedProd;

    const weightLabel = `${Math.round(rawWeightInGrams)} گم`;

    const scaleItem = {
      id: selectedProd ? selectedProd.id : `scale_${Date.now()}`,
      cartKey: selectedProd ? `${selectedProd.id}_PIECE` : `scale_${Date.now()}`,
      name: selectedProd ? `${selectedProd.name} (${weightLabel})` : `${name} (${weightLabel})`,
      barcode: selectedProd ? selectedProd.barcode : `SCALE_${Date.now()}`,
      price: pricePerKg,
      selling_price: pricePerKg,
      stock: selectedProd ? selectedProd.stock : 999,
      quantity: weightInKg,
      is_custom: isCustomScale,
      is_weighted: true,
      unit: 'گم',
      unit_type: 'PIECE',
      units_per_box: 1
    };
    setCart(prev => [scaleItem, ...prev]);
    setScaleItemName('');
    setScalePricePerKg('');
    setScaleWeight('500');
    setScaleAmount('');
    setScaleUnit('G');
    setScaleSelectedProductId('');
    setIsScaleSearchOpen(false);
    setIsScaleModalOpen(false);
  };

  // Invoice-based Return Handlers (سادە، خێرا، بەپێی پسووڵە بێ وەسڵ لەسەر هەمان شاشە)
  const handleOpenReturnModal = async () => {
    setIsReturnModalOpen(true);
    setReturnSaleIdInput('');
    setReturnSearchedSale(null);
    setReturnSelectedSaleItem(null);
    setReturnQtyInput(1);
    setReturnModalNotice(null);
    setIsInvoiceDropdownOpen(false);
    setTimeout(() => {
      returnInputRef.current?.focus();
    }, 100);

    // Fetch latest sales that have returnable items for quick return selection
    try {
      const res = await axios.get('http://localhost:3001/api/returns/recent-sales');
      if (res.data?.status === 'SUCCESS' && Array.isArray(res.data.data)) {
        setReturnRecentSales(res.data.data.slice(0, 15));
      } else {
        const fallback = await axios.get('http://localhost:3001/api/checkout');
        const list = Array.isArray(fallback.data) ? fallback.data : (fallback.data?.data || []);
        setReturnRecentSales(list.filter(s => Number(s.item_count) > 0).slice(0, 15));
      }
    } catch (_) {}
  };

  const handleSearchSaleForReturn = async (overrideId) => {
    setIsInvoiceDropdownOpen(false);
    const raw = overrideId !== undefined ? String(overrideId) : returnSaleIdInput;
    let cleanId = raw.trim();
    if (/shrm\/\d+\//i.test(cleanId)) {
      const parts = cleanId.split('/');
      const lastPart = parts[parts.length - 1];
      cleanId = String(parseInt(lastPart, 10) || '');
    } else {
      cleanId = cleanId.replace(/[^0-9]/g, '');
    }
    if (!cleanId) {
      setReturnModalNotice({ type: 'error', text: 'تکایە ژمارەی پسووڵە بنووسە یان سکان بکە' });
      return;
    }

    setIsSearchingReturnSale(true);
    setReturnModalNotice(null);
    setReturnSearchedSale(null);
    setReturnSelectedSaleItem(null);

    try {
      const res = await axios.get(`http://localhost:3001/api/returns/sale/${cleanId}`);
      if (res.data.status === 'SUCCESS' && res.data.data) {
        const saleData = res.data.data;

        if (!saleData.items || saleData.items.length === 0) {
          setReturnModalNotice({ type: 'error', text: 'ئەم پسووڵەیە هیچ کاڵایەکی تێدا نییە بۆ گەڕاندنەوە' });
          return;
        }

        const availableItems = (saleData.items || []).filter(it => it.returnable_qty > 0);
        if (availableItems.length >= 1) {
          setReturnSearchedSale(saleData);
          setReturnSaleIdInput(String(saleData.id));
          setReturnSelectedSaleItem(availableItems[0]);
          setReturnQtyInput(availableItems[0].returnable_qty);
        } else {
          setReturnSearchedSale(null);
          setReturnSelectedSaleItem(null);
          setReturnModalNotice({ type: 'error', text: 'هەموو کاڵاکانی ئەم پسووڵەیە پێشتر گەڕێنراونەتەوە' });
        }
      } else {
        setReturnModalNotice({ type: 'error', text: 'پسووڵەی داواکراو نەدۆزرایەوە' });
      }
    } catch (err) {
      setReturnModalNotice({
        type: 'error',
        text: err.response?.data?.message || 'پسووڵەی داواکراو نەدۆزرایەوە'
      });
    } finally {
      setIsSearchingReturnSale(false);
    }
  };

  const handleReturnQtyChange = (val, maxQty) => {
    if (val === '') {
      setReturnQtyInput('');
      return;
    }
    let num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setReturnQtyInput(1);
      return;
    }
    if (num > maxQty) {
      num = maxQty;
      setReturnModalNotice({ 
        type: 'error', 
        text: `ناتوانی لە بڕی کڕدراو زیاتر بگەڕێنیتەوە (زۆرترین بڕ: ${maxQty})` 
      });
      setTimeout(() => setReturnModalNotice(null), 3000);
    } else {
      setReturnModalNotice(null);
    }
    setReturnQtyInput(num);
  };

  const handleConfirmInvoiceReturn = async (e) => {
    e?.preventDefault();
    if (!returnSearchedSale || !returnSelectedSaleItem) {
      setReturnModalNotice({ type: 'error', text: 'تکایە کاڵایەک بۆ گەڕاندنەوە لەم پسووڵەیە دیاریبکە' });
      return;
    }

    const qty = parseFloat(returnQtyInput) || 0;
    if (qty <= 0) {
      setReturnModalNotice({ type: 'error', text: 'تکایە بڕی گەڕاندنەوە بە دروستی بنووسە' });
      return;
    }

    const maxAllowed = Number(returnSelectedSaleItem.returnable_qty) || 0;
    if (qty > maxAllowed) {
      setReturnModalNotice({ 
        type: 'error', 
        text: `بڕی گەڕاندنەوە ناتوانێت لە ${maxAllowed} زیاتر بێت` 
      });
      return;
    }

    setIsExecutingReturn(true);
    setReturnModalNotice(null);

    try {
      const res = await axios.post('http://localhost:3001/api/returns', {
        sale_id: returnSearchedSale.id,
        product_id: returnSelectedSaleItem.product_id,
        quantity: qty,
        reason: 'خواستی کڕیار',
        refund_method: returnSearchedSale.recommended_refund_method || 'CASH'
      });

      if (res.data.status === 'SUCCESS') {
        // Auto kick cash drawer if electron & cash
        if (window.require && (returnSearchedSale.recommended_refund_method || 'CASH') === 'CASH') {
          try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('open-cash-drawer');
          } catch (_) {}
        }

        // Refresh inventory and stats
        fetchData();

        // Immediately close modal and reset inputs (No print receipt, no redirection)
        setIsReturnModalOpen(false);
        setReturnSearchedSale(null);
        setReturnSelectedSaleItem(null);
        setReturnSaleIdInput('');
        setReturnQtyInput(1);
        setReturnModalNotice(null);
      }
    } catch (err) {
      console.error('Invoice return error:', err);
      setReturnModalNotice({
        type: 'error',
        text: err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی گەڕاندنەوە'
      });
    } finally {
      setIsExecutingReturn(false);
    }
  };

  // Open Cash Drawer Trigger (دەستبەجێ و بێ پەیامی زیادە)
  const handleOpenCashDrawer = () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('open-cash-drawer');
      } catch (_) {}
    }
  };

  // Barcode Handler (Hardware wedge + manual input + electronic scale barcodes)
  const handleProcessBarcode = (code) => {
    if (!code) return;
    const cleanCode = normalizeBarcode(code).trim();

    // 0. Receipt Barcode Check (Auto-Open Return Modal with Receipt)
    if (/shrm\/\d+\//i.test(cleanCode) || /^shrm/i.test(cleanCode)) {
      handleOpenReturnModal();
      handleSearchSaleForReturn(cleanCode);
      return;
    }

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
        setScaleAmount('');
        setScaleUnit('KG');
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
      handleProcessBarcode(normalizeBarcode(barcodeInput));
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

  // Quick Return Calculations & Handlers (placed after getItemPricing)
  const selectedCartItem = useMemo(() => {
    if (!selectedCartKey) return null;
    return cart.find(it => (it.cartKey || it.barcode) === selectedCartKey) || null;
  }, [cart, selectedCartKey]);

  const selectedCartItemPricing = useMemo(() => {
    if (!selectedCartItem) return { unitPrice: 0, lineTotal: 0, regularPrice: 0 };
    const p = getItemPricing(selectedCartItem);
    const unitPrice = Number(p.regularPrice || selectedCartItem.price || 0);
    return { ...p, unitPrice };
  }, [selectedCartItem, getItemPricing]);

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

  // Sync customer search input when selected customer changes
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSearchQuery(selectedCustomer.name);
    } else {
      setCustomerSearchQuery('');
    }
  }, [selectedCustomerId, selectedCustomer]);

  // Click outside to close customer dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered customers for search combobox
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.trim();
    if (!q || (selectedCustomer && q.toLowerCase() === selectedCustomer.name.toLowerCase())) {
      return customers;
    }
    return customers.filter(c => 
      kurdishSearchMatch(c.name, q) || (c.phone && c.phone.includes(q))
    );
  }, [customers, customerSearchQuery, selectedCustomer]);

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
    if (paymentMode === 'DEBT' && !allowDebtSale) {
      return alert('بەڕێوەبەر فرۆشتن بە قەرزی بۆ کاشێر قفڵ کردووە');
    }
    if (paymentMode === 'SPLIT' && !allowSplitPayment) {
      return alert('بەڕێوەبەر پارەدانی تێکەڵی بۆ کاشێر قفڵ کردووە');
    }
    if (calculatedDiscount > 0 && !allowManualDiscount) {
      return alert('بەڕێوەبەر داشکاندنی دەستی بۆ کاشێر قفڵ کردووە');
    }
    if ((paymentMode === 'DEBT' || paymentMode === 'SPLIT') && !selectedCustomerId) {
      return alert('تکایە سەرەتا کڕیارێک دیاریبکە بۆ فرۆشتن بە قەرز یان فرە-جۆر (تێکەڵ)');
    }

    const shouldPrint = forcePrint !== null ? forcePrint : true;

    setIsCheckingOut(true);
    try {
      const payload = {
        items: cart.map(i => ({
          barcode: i.barcode,
          quantity: i.quantity,
          is_custom: i.is_custom || false,
          has_custom_price: i.has_custom_price || false,
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
        discount_amount: calculatedDiscount,
        preventNegativeStock: true
      };

      const res = await axios.post('http://localhost:3001/api/checkout', payload);
      if (res.data.status === 'SUCCESS') {
        const saleId = res.data.saleId;
        
        // Prepare Receipt Data with Promotion Breakdown & Split Payment details
        const receiptData = {
          saleId,
          date: formatDateTime(new Date(), { twelveHour: true }),
          cashierName: currentUser?.full_name || currentUser?.username || 'کاشێر',
          customerName: selectedCustomer ? selectedCustomer.name : 'کڕیاری گشتی',
          customerPhone: selectedCustomer ? selectedCustomer.phone : '',
          paymentMethod: paymentMode,
          paidAmount: effectiveCashPaid,
          debtAmount: effectiveDebtAmount,
          isDebt: paymentMode === 'DEBT',
          isSplit: paymentMode === 'SPLIT',
          tenderedAmount: paymentMode === 'CASH' && cashReceived ? parseFloat(cashReceived) : null,
          changeDue: paymentMode === 'CASH' && cashReceived ? Math.max(0, (parseFloat(cashReceived) || 0) - grandTotal) : null,
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
          }, 300);
        }

        // Auto kick cash drawer if cash was received
        if (paymentMode === 'CASH' || (paymentMode === 'SPLIT' && (Number(effectiveCashPaid) || 0) > 0)) {
          if (window.require) {
            try {
              const { ipcRenderer } = window.require('electron');
              ipcRenderer.send('open-cash-drawer');
            } catch (_) {}
          }
        }

        setCashReceived('');
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
        !selectedCategoryId || 
        selectedCategoryId === 'ALL' || 
        String(p.category_id) === String(selectedCategoryId);

      return matchesSearch && matchesCat;
    });
  }, [products, productSearch, selectedCategoryId]);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', padding: '6px 10px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }} dir="rtl">
      
      {/* Thermal Print Receipt Style */}
      <style>{`
        #cashier-thermal-receipt {
          display: none !important;
        }
        @media screen {
          #cashier-thermal-receipt {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
        }
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #cashier-thermal-receipt {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            box-sizing: border-box !important;
            background: white !important;
            color: black !important;
            padding: 4px 6px !important;
            font-family: monospace, Tahoma, sans-serif !important;
            font-size: 12px !important;
            direction: rtl !important;
            text-align: right !important;
          }
          #cashier-thermal-receipt * {
            visibility: visible !important;
            box-sizing: border-box !important;
          }
          #cashier-thermal-receipt table,
          #cashier-thermal-receipt table th,
          #cashier-thermal-receipt table td {
            color: #000000 !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-divider {
            border-bottom: 1px dashed #000 !important;
            margin: 6px 0 !important;
          }
        }
      `}</style>

      {/* Slim Top Cashier Navigation Bar with 3-Zone Alignment matching the 3-Column Layout */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        marginBottom: '6px',
        borderRadius: '8px',
        flexShrink: 0,
        gap: '10px'
      }}>
        {/* Right Zone (Matches Column 1: Categories - 310px wide) */}
        <div style={{ width: '302px', flex: '0 0 302px', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              fontSize: '0.8rem',
              whiteSpace: 'nowrap'
            }}
            title="گەڕانەوە بۆ پەڕەی سەرەکی"
          >
            <span>سەرەکی</span>
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            <span>{currentUser?.full_name || currentUser?.username || 'کاشێر'}</span>
          </div>
        </div>

        {/* Middle Zone (Matches Column 2: Cart - Exactly the User's Red Box Area!) */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          {/* Right side of Middle Zone: Multi-Cart Tabs (سەلە ١ ، سەلە ٢) */}
          <div style={{ 
            display: 'inline-flex', 
            gap: '4px', 
            background: 'var(--bg-tertiary)', 
            padding: '3px', 
            borderRadius: '8px', 
            border: '1px solid var(--border-color)' 
          }}>
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: isActive ? '1px solid var(--accent-color)' : '1px solid transparent',
                    background: isActive 
                      ? 'var(--accent-color)' 
                      : (hasItems ? 'var(--warning-light)' : 'transparent'),
                    color: isActive ? '#ffffff' : (hasItems ? 'var(--warning-color)' : 'var(--text-secondary)'),
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontSize: '0.8rem',
                    boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                  title={`سویچ بکە بۆ ${c.label}`}
                >
                  <span>{c.label}</span>
                  {itemCount > 0 && (
                    <span style={{ 
                      fontSize: '0.68rem', 
                      padding: '0 5px', 
                      borderRadius: '9999px', 
                      background: isActive 
                        ? 'rgba(255, 255, 255, 0.25)' 
                        : 'rgba(245, 158, 11, 0.25)',
                      color: isActive ? '#ffffff' : '#b45309',
                      fontWeight: 800
                    }}>
                      {itemCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Left side of Middle Zone: Quick Action Tools (تەرازوو، دەستی، بەتاڵکردن) */}
          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            <button 
              type="button" 
              onClick={handleOpenScaleModal}
              title="تەرازوو و فرۆشتنی بە کێش"
              style={{ 
                padding: '4px 10px', 
                borderRadius: '6px', 
                background: 'rgba(2, 132, 199, 0.12)', 
                color: '#0284c7', 
                border: '1px solid rgba(2, 132, 199, 0.35)', 
                fontWeight: 700, 
                fontSize: '0.78rem', 
                cursor: 'pointer', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>تەرازوو</span>
            </button>

            <button 
              type="button" 
              onClick={handleOpenRecentSales}
              title="دوایین فرۆشتنەکان و چاپکردنەوەی وەسڵ"
              style={{ 
                padding: '4px 10px', 
                borderRadius: '6px', 
                background: 'rgba(139, 92, 246, 0.12)', 
                color: '#8b5cf6', 
                border: '1px solid rgba(139, 92, 246, 0.35)', 
                fontWeight: 700, 
                fontSize: '0.78rem', 
                cursor: 'pointer', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>دوایین فرۆشتنەکان</span>
            </button>

            {allowClearCart && (
              <button 
                type="button"
                onClick={clearCart}
                disabled={cart.length === 0}
                style={{ 
                  background: cart.length === 0 ? 'var(--bg-tertiary)' : 'var(--danger-light)', 
                  border: cart.length === 0 ? '1px solid var(--border-color)' : '1px solid rgba(239, 68, 68, 0.35)', 
                  color: cart.length === 0 ? 'var(--text-muted)' : 'var(--danger-color)', 
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer', 
                  fontSize: '0.78rem', 
                  padding: '4px 9px', 
                  borderRadius: '6px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  opacity: cart.length === 0 ? 0.6 : 1,
                  transition: 'all 0.15s ease'
                }}
                title={cart.length === 0 ? "سەبەتە بەتاڵە" : "بەتاڵکردنەوەی تەواوی ئەم سەلەیە"}
              >
                <span>بەتاڵکردن</span>
              </button>
            )}
          </div>
        </div>

        {/* Left Zone (Matches Column 3: Checkout/Totals - 320px wide) */}
        <div style={{ width: '312px', flex: '0 0 312px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            onClick={logout}
            title="دەرچوون لە هەژمار و گەڕانەوە بۆ لۆگین"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '5px', 
              background: 'rgba(239, 68, 68, 0.12)', 
              color: '#ef4444', 
              border: '1px solid rgba(239, 68, 68, 0.35)', 
              borderRadius: '6px', 
              padding: '4px 10px', 
              fontSize: '0.78rem', 
              cursor: 'pointer',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
          >
            <span>دەرچوون</span>
          </button>
        </div>
      </header>

      {/* Main Single-Screen Non-Scrolling 3-Column Layout */}
      <div style={{ display: 'flex', gap: '10px', height: 'calc(100vh - 54px)', overflow: 'hidden' }}>
        
        {/* 1. Right Column: Food / Product Categories & Catalog (جۆری خواردنەکان و کاڵاکان) */}
        <div style={{ width: '310px', flex: '0 0 310px', display: 'flex', flexDirection: 'column', height: '100%', gap: '6px' }}>
          
          {/* Top Barcode Input & Search Header */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            padding: '6px 8px', 
            borderRadius: '10px', 
            display: 'flex', 
            flexDirection: 'column',
            gap: '6px', 
            flexShrink: 0
          }}>
            <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input 
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="سکانکردنی بارکۆد..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(normalizeBarcode(e.target.value))}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '7px 10px', 
                    borderRadius: '8px', 
                    background: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text-primary)', 
                    fontFamily: 'monospace', 
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary"
                style={{ padding: '0 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.84rem', flexShrink: 0 }}
              >
                سکان
              </button>
            </form>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: 'var(--bg-tertiary)', 
              padding: '6px 10px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <input 
                type="text" 
                placeholder="گەڕان بە ناوی کاڵا..." 
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.86rem', boxShadow: 'none', padding: 0 }}
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Quick Drill-Down View */}
          {(!selectedCategoryId && !productSearch.trim()) ? (
            /* 1. Categories View: Shows only categories initially */
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <span>جۆری خواردن و کاڵاکان:</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>({categories.length + 1} جۆر)</span>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
                alignContent: 'start',
                gridAutoRows: '60px',
                gap: '6px', 
                padding: '2px' 
              }}>
                {/* Individual Categories */}
                {categories.map(cat => {
                  const count = products.filter(p => String(p.category_id) === String(cat.id)).length;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        height: '60px',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        textAlign: 'center',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ 
                        fontWeight: 800, 
                        fontSize: '0.86rem', 
                        color: 'var(--text-primary)',
                        lineHeight: '1.2',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {cat.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: '1' }}>
                        ({count})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 2. Items View: Shows items for the selected category or search - ONLY ITEM NAME */
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {/* Back to Categories Header */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '5px 8px', 
                marginBottom: '6px', 
                background: 'var(--bg-secondary)', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)',
                flexShrink: 0
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setProductSearch('');
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="گەڕانەوە بۆ جۆرەکان"
                >
                  جۆرەکان
                </button>

                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  {selectedCategoryId === 'ALL' ? 'هەموو کاڵاکان' : (categories.find(c => String(c.id) === String(selectedCategoryId))?.name || (productSearch ? 'گەڕان' : 'کاڵاکان'))}
                </span>

                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ({filteredProducts.length})
                </span>
              </div>

              {/* Items Grid: ONLY the item name */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
                alignContent: 'start',
                gridAutoRows: '60px',
                gap: '6px', 
                flex: 1, 
                minHeight: 0, 
                overflowY: 'auto', 
                padding: '2px' 
              }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    هیچ کاڵایەک نەدۆزرایەوە
                  </div>
                ) : (
                  filteredProducts.map(p => {
                    const isOutOfStock = !p.is_weighted && Number(p.stock) <= 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p, 1, 'PIECE')}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '10px',
                          border: isOutOfStock ? '1px dashed #ef4444' : '1px solid var(--border-color)',
                          background: isOutOfStock ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-secondary)',
                          opacity: isOutOfStock ? 0.6 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          height: '60px',
                          minHeight: '60px',
                          maxHeight: '60px',
                          boxSizing: 'border-box',
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ 
                          fontWeight: 800, 
                          fontSize: '0.84rem', 
                          color: isOutOfStock ? '#ef4444' : 'var(--text-primary)', 
                          lineHeight: '1.25',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word'
                        }}>
                          {p.name}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}
        </div>

        {/* Middle Column: Interactive Cart Table */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            {/* Permanent Fixed Table Header (Always visible even when cart is empty) */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '36px minmax(130px, 1fr) 125px 95px 110px 36px', 
              gap: '8px', 
              alignItems: 'center', 
              padding: '8px 10px', 
              background: 'var(--bg-tertiary)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              fontSize: '0.8rem', 
              fontWeight: 800, 
              color: 'var(--text-secondary)', 
              marginBottom: '6px',
              flexShrink: 0
            }}>
              <span style={{ textAlign: 'center' }}>#</span>
              <span style={{ textAlign: 'center' }}>ناوی کاڵا</span>
              <span style={{ textAlign: 'center' }}>بڕ</span>
              <span style={{ textAlign: 'center' }}>نرخ</span>
              <span style={{ textAlign: 'left' }}>کۆ</span>
              <span style={{ textAlign: 'center' }}></span>
            </div>

            {/* Cart Items List or Empty State */}
            {cart.length === 0 ? (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%', 
                minHeight: '260px'
              }} />
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '2px' }}>
                {cart.map((item, index) => {
                  const pricing = getItemPricing(item);
                    const lineTotal = pricing.lineTotal;
                    const isKg = item.unit === 'کگم' || item.is_weighted;
                    const itemKey = item.cartKey || item.barcode;
                    const isSelected = selectedCartKey === itemKey;
                    return (
                      <div 
                        key={itemKey}
                        onClick={(e) => {
                          if (e.target.closest('button') || e.target.closest('input')) return;
                          const nextKey = isSelected ? null : itemKey;
                          setSelectedCartKey(nextKey);
                          if (nextKey) {
                            setReturnQuantity(Math.min(1, Number(item.quantity) || 1));
                          }
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '36px minmax(130px, 1fr) 125px 95px 110px 36px',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(245, 158, 11, 0.16)'
                            : (item.unit_type === 'BOX' 
                              ? 'rgba(2, 132, 199, 0.08)' 
                              : (pricing.hasPromo ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-tertiary)')),
                          border: isSelected
                            ? '1.5px solid #f59e0b'
                            : (item.unit_type === 'BOX' 
                              ? '1px solid rgba(2, 132, 199, 0.35)' 
                              : (pricing.hasPromo ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid var(--border-color)')),
                          boxShadow: isSelected ? '0 0 0 1px #f59e0b' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* # (ژمارەی ڕیز) */}
                        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.82rem', color: isSelected ? '#f59e0b' : 'var(--text-muted)' }}>
                          {index + 1}
                        </div>

                        {/* ناوی کاڵا */}
                        <div style={{ minWidth: 0, textAlign: 'center' }}>
                          <div style={{ 
                            fontWeight: 800, 
                            fontSize: '0.88rem', 
                            color: 'var(--text-primary)', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            textAlign: 'center'
                          }}>
                            {item.name}
                          </div>
                          {(item.is_custom || (pricing.hasPromo && item.unit_type !== 'BOX')) && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                              {item.is_custom && (
                                <span style={{ fontSize: '0.68rem', background: isKg ? 'rgba(2, 132, 199, 0.12)' : 'var(--warning-light)', color: isKg ? '#0284c7' : '#b45309', padding: '0 5px', borderRadius: '4px', fontWeight: 700 }}>
                                  {isKg ? 'بە کێش' : 'دەستی'}
                                </span>
                              )}
                              {pricing.hasPromo && item.unit_type !== 'BOX' && (
                                <span style={{ fontSize: '0.68rem', background: 'rgba(217, 119, 6, 0.12)', color: '#d97706', padding: '0 5px', borderRadius: '4px', fontWeight: 700 }}>
                                  ئۆفەر
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* دانە */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                          <button 
                            type="button"
                            onClick={() => {
                              const step = isKg ? 0.25 : 1;
                              const targetQty = Math.round((Number(item.quantity) - step) * 1000) / 1000;
                              updateQuantity(itemKey, Math.max(0, targetQty));
                            }}
                            title="کەمکردنەوە"
                            style={{ 
                              width: '26px', 
                              height: '26px', 
                              borderRadius: '6px', 
                              background: Number(item.quantity) <= (isKg ? 0.25 : 1) ? 'var(--danger-light)' : 'var(--bg-secondary)', 
                              color: Number(item.quantity) <= (isKg ? 0.25 : 1) ? 'var(--danger-color)' : 'var(--text-primary)', 
                              border: '1px solid var(--border-color)', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              padding: 0
                            }}
                          >
                            <span style={{ fontSize: '1rem', lineHeight: 1, fontWeight: 800 }}>−</span>
                          </button>
                          
                          <input 
                            type="number" 
                            step={isKg ? '0.05' : '1'}
                            min="0"
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                            onChange={(e) => updateQuantity(itemKey, e.target.value)}
                            style={{ 
                              width: '44px', 
                              padding: '2px 0', 
                              textAlign: 'center', 
                              background: 'var(--bg-secondary)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '6px', 
                              color: 'var(--text-primary)', 
                              fontWeight: 800, 
                              fontSize: '0.86rem', 
                              outline: 'none' 
                            }}
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
                              width: '26px', 
                              height: '26px', 
                              borderRadius: '6px', 
                              background: 'var(--bg-secondary)', 
                              color: 'var(--text-primary)', 
                              border: '1px solid var(--border-color)', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              padding: 0
                            }}
                          >
                            <span style={{ fontSize: '1rem', lineHeight: 1, fontWeight: 800 }}>+</span>
                          </button>
                        </div>

                        {/* نرخ */}
                        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          {item.price.toLocaleString()} د.ع
                        </div>

                        {/* کۆ */}
                        <div style={{ textAlign: 'left', fontWeight: 800, fontSize: '0.88rem', color: item.unit_type === 'BOX' ? '#0284c7' : 'var(--accent-hover)' }}>
                          {lineTotal.toLocaleString()} د.ع
                        </div>

                        {/* کردار (سڕینەوە) */}
                        <div style={{ textAlign: 'center' }}>
                          {allowDeleteItem && (
                            <button 
                              type="button"
                              onClick={() => removeFromCart(itemKey)}
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--danger-color)', 
                                cursor: 'pointer', 
                                padding: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="سڕینەوە"
                            >
                              <span style={{ fontSize: '0.95rem', fontWeight: 800, lineHeight: 1 }}>✕</span>
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
            )}

          </div>
        </div>

        {/* 3. Left Column: Totals, Payment & Checkout (کۆی گشتی، پارەدان و چاپکردن) */}
        <div style={{ width: '320px', flex: '0 0 320px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            padding: '12px 14px', 
            borderRadius: '14px',
            boxShadow: 'var(--card-shadow)',
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            {/* Top: Payment Methods */}
            <div>

              {/* Payment Mode Selector Tabs (CASH, DEBT, SPLIT) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px', width: '100%', boxSizing: 'border-box' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('CASH');
                    setSelectedCustomerId('');
                    setSplitCashAmount('');
                  }}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    padding: '7px 4px',
                    borderRadius: '8px',
                    border: paymentMode === 'CASH' ? '1px solid var(--success-color)' : '1px solid var(--border-color)',
                    background: paymentMode === 'CASH' ? 'var(--success-light)' : 'var(--bg-tertiary)',
                    color: paymentMode === 'CASH' ? 'var(--success-color)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>نەقد</span>
                </button>

                {allowDebtSale ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('DEBT');
                      setSplitCashAmount('');
                    }}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: paymentMode === 'DEBT' ? '1px solid var(--danger-color)' : '1px solid var(--border-color)',
                      background: paymentMode === 'DEBT' ? 'var(--danger-light)' : 'var(--bg-tertiary)',
                      color: paymentMode === 'DEBT' ? 'var(--danger-color)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>قەرز</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={true}
                    title="بەڕێوەبەر فرۆشتن بە قەرزی بۆ کاشێر قفڵ کردووە"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      opacity: 0.6
                    }}
                  >
                    <span>قەرز</span>
                  </button>
                )}

                {allowSplitPayment ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('SPLIT');
                      setSplitCashAmount('0');
                      setTimeout(() => {
                        splitCashInputRef.current?.focus();
                        splitCashInputRef.current?.select();
                      }, 50);
                    }}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: paymentMode === 'SPLIT' ? '1px solid var(--warning-color)' : '1px solid var(--border-color)',
                      background: paymentMode === 'SPLIT' ? 'var(--warning-light)' : 'var(--bg-tertiary)',
                      color: paymentMode === 'SPLIT' ? '#b45309' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>تێکەڵ</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={true}
                    title="بەڕێوەبەر پارەدانی تێکەڵی بۆ کاشێر قفڵ کردووە"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      opacity: 0.6
                    }}
                  >
                    <span>تێکەڵ</span>
                  </button>
                )}
              </div>

              {/* Customer Selection Row: Only shown when paymentMode is DEBT or SPLIT */}
              {(paymentMode === 'DEBT' || paymentMode === 'SPLIT') && (
                <div 
                  ref={customerSearchRef}
                  style={{ 
                    position: 'relative',
                    display: 'flex', 
                    gap: '6px', 
                    alignItems: 'center', 
                    marginBottom: '8px', 
                    background: 'var(--bg-tertiary)', 
                    padding: '5px 8px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)', 
                    flexShrink: 0, 
                    width: '100%', 
                    boxSizing: 'border-box' 
                  }}
                >
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        ref={customerInputRef}
                        type="text" 
                        placeholder="ناوی کڕیار..."
                        value={customerSearchQuery}
                        onFocus={(e) => {
                          setIsCustomerDropdownOpen(true);
                          e.target.select();
                        }}
                        onClick={(e) => {
                          setIsCustomerDropdownOpen(true);
                          e.target.select();
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomerSearchQuery(val);
                          setIsCustomerDropdownOpen(true);
                          if (selectedCustomerId && val !== selectedCustomer?.name) {
                            setSelectedCustomerId('');
                          }
                        }}
                        style={{ 
                          width: '100%', 
                          padding: selectedCustomerId ? '5px 24px 5px 8px' : '5px 8px', 
                          borderRadius: '6px', 
                          background: 'var(--bg-secondary)', 
                          border: selectedCustomerId ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color)', 
                          color: 'var(--text-primary)', 
                          fontSize: '0.82rem', 
                          fontWeight: selectedCustomerId ? 700 : 500,
                          outline: 'none',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          boxSizing: 'border-box'
                        }}
                      />

                      {/* Clear Button */}
                      {selectedCustomerId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomerId('');
                            setCustomerSearchQuery('');
                            setIsCustomerDropdownOpen(true);
                            customerInputRef.current?.focus();
                          }}
                          title="لابردنی کڕیار"
                          style={{
                            position: 'absolute',
                            left: '5px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%'
                          }}
                        >
                          <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>✕</span>
                        </button>
                      )}
                    </div>

                    {/* Floating Dropdown List of Filtered Customers */}
                    {isCustomerDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        left: 0,
                        background: 'var(--bg-secondary)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxSizing: 'border-box'
                      }}>
                        {filteredCustomers.map(c => {
                          const isSelected = String(selectedCustomerId) === String(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerSearchQuery(c.name);
                                setIsCustomerDropdownOpen(false);
                              }}
                              style={{
                                padding: '7px 10px',
                                cursor: 'pointer',
                                background: isSelected ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
                                color: isSelected ? 'var(--primary-color)' : 'var(--text-primary)',
                                fontWeight: isSelected ? 800 : 600,
                                fontSize: '0.82rem',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.1s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span>{c.name}</span>
                              {isSelected && <span style={{ color: 'var(--primary-color)', fontWeight: 800 }}>✓</span>}
                            </div>
                          );
                        })}
                        {filteredCustomers.length === 0 && (
                          <div style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                            هیچ کڕیارێک نەدۆزرایەوە
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
                    <span>+ کڕیار</span>
                  </button>
                </div>
              )}

              {/* Simple Clean Split Payment Section */}
              {paymentMode === 'SPLIT' && (
                <div style={{ 
                  marginBottom: '8px', 
                  padding: '8px 10px', 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-color)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px', width: '100%', boxSizing: 'border-box' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      بڕی نەقد:
                    </span>
                    <input
                      ref={splitCashInputRef}
                      type="number"
                      min="0"
                      max={grandTotal > 0 ? grandTotal : undefined}
                      step="any"
                      value={splitCashAmount}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => e.target.select()}
                      onMouseUp={(e) => e.target.select()}
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                      style={{ 
                        width: '125px',
                        maxWidth: '135px',
                        height: '32px',
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: 'var(--bg-secondary)', 
                        border: '1px solid var(--border-color)', 
                        color: 'var(--success-color)', 
                        fontSize: '0.95rem', 
                        fontWeight: 800, 
                        textAlign: 'center', 
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: '0.78rem', 
                    paddingTop: '6px', 
                    borderTop: '1px solid var(--border-color)',
                    fontWeight: 800,
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <span style={{ color: 'var(--success-color)', whiteSpace: 'nowrap' }}>نەقد: {effectiveCashPaid.toLocaleString()} د.ع</span>
                    <span style={{ color: 'var(--danger-color)', whiteSpace: 'nowrap' }}>قەرز: {effectiveDebtAmount.toLocaleString()} د.ع</span>
                  </div>
                </div>
              )}

              {/* Cash Tendered & Change Due Calculator (Simplified & Clean) */}
              {paymentMode === 'CASH' && (
                <div style={{
                  marginTop: '6px',
                  marginBottom: '6px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  padding: '9px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxSizing: 'border-box',
                  width: '100%'
                }}>
                  {/* Cash Received Input */}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="بڕی پارەی کڕیار..."
                    value={cashReceived}
                    onClick={(e) => e.target.select()}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setCashReceived(e.target.value)}
                    style={{
                      width: '100%',
                      height: '35px',
                      padding: '4px 8px',
                      borderRadius: '7px',
                      background: 'var(--bg-secondary)',
                      border: '1.5px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  {/* 2x2 Quick Banknote Buttons (Normal clean buttons, never stuck as selected) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {[
                      { label: '٥,٠٠٠ د.ع', val: 5000 },
                      { label: '١٠,٠٠٠ د.ع', val: 10000 },
                      { label: '٢٥,٠٠٠ د.ع', val: 25000 },
                      { label: '٥٠,٠٠٠ د.ع', val: 50000 },
                    ].map(denom => (
                      <button
                        key={denom.val}
                        type="button"
                        onClick={() => setCashReceived(String(denom.val))}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '7px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      >
                        {denom.label}
                      </button>
                    ))}
                  </div>

                  {/* Change Due / Short Display */}
                  {parseFloat(cashReceived) > 0 && grandTotal > 0 && (() => {
                    const received = parseFloat(cashReceived) || 0;
                    const changeDue = Math.max(0, received - grandTotal);
                    const isShort = received < grandTotal;
                    const shortAmount = isShort ? grandTotal - received : 0;
                    return (
                      <div style={{
                        marginTop: '2px',
                        padding: '5px 10px',
                        minHeight: '33px',
                        borderRadius: '7px',
                        background: isShort ? 'var(--danger-light)' : 'rgba(16, 185, 129, 0.16)',
                        border: isShort ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: isShort ? 'var(--danger-color)' : 'var(--success-color)'
                        }}>
                          {isShort ? 'پارەی کەمە:' : 'باقی (گەڕاوە):'}
                        </span>
                        <span style={{
                          fontSize: '1.02rem',
                          fontWeight: 900,
                          color: isShort ? 'var(--danger-color)' : 'var(--success-color)'
                        }}>
                          {isShort ? `${shortAmount.toLocaleString()} د.ع` : `${changeDue.toLocaleString()} د.ع`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Bottom: Totals Breakdown, Auto-Print & Checkout Buttons */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: 'auto' }}>
              
              {/* Dedicated Return Item Button - Fixed Position */}
              <div style={{ marginBottom: '8px' }}>
                <button 
                  type="button" 
                  onClick={handleOpenReturnModal}
                  title="گەڕاندنەوە بەپێی پسووڵە (F2)"
                  style={{ 
                    width: '100%',
                    height: '36px',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '8px', 
                    background: 'rgba(245, 158, 11, 0.12)', 
                    color: '#f59e0b', 
                    border: '1.5px solid rgba(245, 158, 11, 0.4)', 
                    borderRadius: '9px', 
                    fontSize: '0.86rem', 
                    cursor: 'pointer',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.1)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>گەڕاندنەوەی کاڵا</span>
                </button>
              </div>

              {/* Quick Cashier Actions Row (دوگمەی چاپکردنەوە) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginBottom: '8px' }}>
                <button 
                  type="button" 
                  onClick={handleReprintLastReceipt}
                  title="چاپکردنەوەی دوایین پسووڵە (F8)"
                  style={{ 
                    height: '34px',
                    width: '100%',
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '5px', 
                    background: 'rgba(56, 189, 248, 0.12)', 
                    color: '#38bdf8', 
                    border: '1px solid rgba(56, 189, 248, 0.35)', 
                    borderRadius: '8px', 
                    fontSize: '0.82rem', 
                    cursor: 'pointer',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>چاپکردنەوە</span>
                </button>
              </div>

              {/* Big Grand Total Display (Higher & Taller across CASH, DEBT, and SPLIT) */}
              <div style={{ 
                background: 'var(--bg-tertiary)', 
                padding: '22px 14px', 
                minHeight: '120px',
                borderRadius: '14px', 
                border: '1.5px solid var(--border-color)', 
                marginBottom: '10px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
                width: '100%'
              }}>
                <div style={{ 
                  fontSize: '0.95rem', 
                  color: 'var(--text-secondary)', 
                  fontWeight: 800, 
                  letterSpacing: '0.3px',
                  paddingBottom: '8px'
                }}>
                  کۆی گشتی
                </div>

                {/* Dividing Line */}
                <div style={{ 
                  height: '1px', 
                  background: 'var(--border-color)', 
                  margin: '0 auto 10px auto', 
                  width: '85%',
                  opacity: 0.8
                }} />

                <div style={{ 
                  fontSize: '2.15rem', 
                  fontWeight: 900, 
                  color: paymentMode === 'DEBT' ? 'var(--danger-color)' : (paymentMode === 'SPLIT' ? 'var(--warning-color)' : 'var(--accent-hover)'),
                  lineHeight: '1.2'
                }}>
                  {grandTotal.toLocaleString()} دینار
                </div>
              </div>

              {/* Clean Compact Discount Section Under Grand Total */}
              <div style={{ 
                background: 'var(--bg-tertiary)', 
                padding: '4px 8px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  داشکاندن:
                </span>
                <input 
                  type="number"
                  min="0"
                  max={subtotal > 0 ? subtotal : undefined}
                  step="any"
                  placeholder="0"
                  value={discountValue}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.target.select()}
                  onChange={(e) => {
                    setDiscountType('AMOUNT');
                    setDiscountValue(e.target.value);
                  }}
                  style={{ 
                    flex: 1, 
                    minWidth: 0, 
                    padding: '3px 6px', 
                    height: '28px',
                    borderRadius: '5px', 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    color: calculatedDiscount > 0 ? 'var(--danger-color)' : 'var(--text-primary)', 
                    fontSize: '0.8rem', 
                    fontWeight: 800, 
                    textAlign: 'center', 
                    outline: 'none' 
                  }}
                />
                {calculatedDiscount > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountValue('')}
                    style={{
                      padding: '2px 6px',
                      height: '26px',
                      borderRadius: '5px',
                      background: 'var(--danger-light)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: 'var(--danger-color)',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="لابردنی داشکاندن"
                  >
                    سڕینەوە
                  </button>
                )}
              </div>





              {/* Dual Action Checkout Buttons (Side-by-Side Square POS Tiles - Taller 88px) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleCheckout(true)}
                  disabled={isCheckingOut || cart.length === 0}
                  style={{
                    height: '88px',
                    borderRadius: '12px',
                    background: cart.length === 0 
                      ? 'var(--bg-tertiary)' 
                      : (paymentMode === 'DEBT' ? 'var(--danger-color)' : (paymentMode === 'SPLIT' ? 'var(--warning-color)' : 'var(--success-color)')),
                    color: cart.length === 0 ? 'var(--text-muted)' : '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: cart.length === 0 ? 'none' : '0 3px 8px rgba(0, 0, 0, 0.15)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ lineHeight: '1.2', textAlign: 'center', fontSize: '1rem', fontWeight: 800 }}>{isCheckingOut ? '...' : 'پارەدان و چاپ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCheckout(false)}
                  disabled={isCheckingOut || cart.length === 0}
                  style={{
                    height: '88px',
                    borderRadius: '12px',
                    background: cart.length === 0 ? 'var(--bg-tertiary)' : 'var(--primary-color)',
                    color: cart.length === 0 ? 'var(--text-muted)' : '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: cart.length === 0 ? 'none' : '0 3px 8px rgba(37, 99, 235, 0.2)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ lineHeight: '1.2', textAlign: 'center', fontSize: '1rem', fontWeight: 800 }}>{isCheckingOut ? '...' : 'فرۆشتن بێ چاپ'}</span>
                </button>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* Hidden Thermal Receipt Container (Targeted by @media print) */}
      {printedReceipt && (
        <div id="cashier-thermal-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>مارکێتی شارەکەم</div>

          {/* Unique Barcode directly below store name */}
          <div style={{ textAlign: 'center', margin: '4px 0 6px 0' }}>
            <BarcodeSVG value={`shrm/2026/${String(printedReceipt.saleId).padStart(4, '0')}`} maxWidth="62mm" barHeight={52} />
          </div>

          <div className="receipt-divider"></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#000000', fontWeight: 'bold' }}>
            <span>بەروار و کات:</span>
            <span>{printedReceipt.date}</span>
          </div>

          <div className="receipt-divider"></div>

          {/* 5-Column Grid Table matching Cashier screen (#، کاڵا، دانە، نرخ، کۆ) with vertical borders */}
          <table style={{ 
            width: '100%', 
            tableLayout: 'fixed',
            borderCollapse: 'collapse', 
            border: '1px solid #000000', 
            direction: 'rtl',
            fontSize: '10.5px',
            margin: '5px 0',
            boxSizing: 'border-box',
            color: '#000000'
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000000', background: '#f5f5f5', color: '#000000' }}>
                <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '20px', color: '#000000', fontWeight: 'bold' }}>#</th>
                <th style={{ border: '1px solid #000000', padding: '3px 3px', textAlign: 'right', color: '#000000', fontWeight: 'bold' }}>کاڵا</th>
                <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '38px', color: '#000000', fontWeight: 'bold' }}>دانە</th>
                <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '44px', color: '#000000', fontWeight: 'bold' }}>نرخ</th>
                <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '48px', color: '#000000', fontWeight: 'bold' }}>کۆ</th>
              </tr>
            </thead>
            <tbody>
              {printedReceipt.items.map((it, idx) => {
                const qtyVal = Number(it.quantity) || 0;
                const cleanQty = Number.isInteger(qtyVal) ? qtyVal : parseFloat(qtyVal.toFixed(3));
                const isGramOrWeight = it.unit === 'گم' || it.unit === 'کگم' || it.unit === 'گرام' || it.unit === 'کیلۆ' || it.unit_type === 'WEIGHT' || String(it.unit || '').includes('گم') || String(it.unit || '').includes('کێش');
                const isBox = it.unit_type === 'BOX' || it.unit === 'کارتۆن';
                const displayQty = isGramOrWeight ? `${cleanQty} گم` : (isBox ? `${cleanQty} کارتۆن` : cleanQty);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #000000', color: '#000000' }}>
                    <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', color: '#000000', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000000', padding: '3px 3px', textAlign: 'right', color: '#000000', fontWeight: 'bold', overflow: 'hidden', wordBreak: 'break-word' }}>{it.name}</td>
                    <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{displayQty}</td>
                    <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{Number(it.price).toLocaleString()}</td>
                    <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{Number(it.total).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="receipt-divider"></div>

          {printedReceipt.promotionalSavings > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
              <span>پاشەکەوتی ئۆفەرەکان:</span>
              <span>-{printedReceipt.promotionalSavings.toLocaleString()} دینار</span>
            </div>
          )}

          {printedReceipt.discount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>کۆی سەرەتایی:</span>
                <span>{printedReceipt.subtotal.toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#333' }}>
                <span>داشکاندنی وەسڵ:</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                <span>شێوازی پارەدان:</span>
                <span>فرە-جۆر (تێکەڵ)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>دراو بە نەقد:</span>
                <span>{Number(printedReceipt.paidAmount || 0).toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                <span>ماوە بە قەرز:</span>
                <span>{Number(printedReceipt.debtAmount || 0).toLocaleString()} دینار</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
              <span>شێوازی پارەدان:</span>
              <span>{printedReceipt.isDebt ? 'قەرز' : 'نەقد'}</span>
            </div>
          )}

          {printedReceipt.tenderedAmount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '3px' }}>
                <span>پارەی وەرگیراو:</span>
                <span>{printedReceipt.tenderedAmount.toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>
                <span>باقی (گەڕاوە):</span>
                <span>{(printedReceipt.changeDue || 0).toLocaleString()} دینار</span>
              </div>
            </>
          )}

          <div className="receipt-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>بەخێربێن بۆ مارکێتی شارەکەم</div>
        </div>
      )}

      {/* Invoice-based Return Modal - Minimalist & Clean */}
      {isReturnModalOpen && (
        <div 
          className="pos-modal-overlay" 
          onClick={() => { setIsReturnModalOpen(false); setIsInvoiceDropdownOpen(false); }}
          style={{ backdropFilter: 'blur(5px)', background: 'rgba(0, 0, 0, 0.6)', zIndex: 1050 }}
        >
          <div 
            className="pos-modal-card no-scroll" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              padding: '1.8rem 2rem', 
              maxWidth: '580px', 
              width: '95%',
              maxHeight: '90vh',
              minHeight: '460px',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px', 
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
              direction: 'rtl'
            }}
          >
            {/* Header: Title and Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={20} style={{ color: 'var(--text-primary)' }} />
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  گەڕاندنەوە بەپێی پسووڵە
                </h2>
              </div>
              <button 
                type="button"
                id="return-modal-close-btn"
                onClick={() => { setIsReturnModalOpen(false); setIsInvoiceDropdownOpen(false); }} 
                title="داخستن"
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer', 
                  width: '30px', 
                  height: '30px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}
              >
                <XIcon size={17} />
              </button>
            </div>

            <form noValidate onSubmit={handleConfirmInvoiceReturn} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1, minHeight: 0 }}>
              
              {/* Notice if error only */}
              {returnModalNotice && returnModalNotice.type === 'error' && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '0.88rem',
                  fontWeight: 700
                }}>
                  {returnModalNotice.text}
                </div>
              )}

              {/* Step 1: Invoice Search (If no sale loaded yet) - NO return button */}
              {!returnSearchedSale ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', flex: 1, minHeight: 0 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.88rem' }}>
                      ژمارەی پسووڵە
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input 
                          ref={returnInputRef}
                          type="text" 
                          id="return-sale-id-input"
                          autoFocus
                          placeholder="ژمارەی پسووڵە لێبدە یان سکان بکە..."
                          value={returnSaleIdInput}
                          onChange={(e) => setReturnSaleIdInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchSaleForReturn();
                            }
                          }}
                          style={{ 
                            width: '100%', 
                            height: '46px',
                            padding: '0 16px',
                            borderRadius: '10px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        id="return-search-fetch-btn"
                        onClick={() => handleSearchSaleForReturn()}
                        disabled={isSearchingReturnSale}
                        style={{
                          height: '46px',
                          padding: '0 24px',
                          borderRadius: '10px',
                          background: 'var(--primary-color)',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.92rem',
                          cursor: isSearchingReturnSale ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isSearchingReturnSale ? 'دەگەڕێت...' : 'هێنان'}
                      </button>
                    </div>
                  </div>

                  {/* Embedded Recent Invoices List with hide-scrollbar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        پسووڵە نوێیەکان:
                      </span>
                    </div>

                    <div 
                      className="hide-scrollbar"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '280px',
                        overflowY: 'auto'
                      }}
                    >
                      {returnRecentSales.length > 0 ? (
                        returnRecentSales
                          .filter(s => !returnSaleIdInput || String(s.id).includes(returnSaleIdInput.trim().replace(/[^0-9]/g, '')))
                          .map(s => (
                            <div
                              key={s.id}
                              onClick={() => handleSearchSaleForReturn(s.id)}
                              style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderRadius: '10px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--primary-color)';
                                e.currentTarget.style.background = 'var(--bg-secondary)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.background = 'var(--bg-tertiary)';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                  پسووڵەی #{s.id}
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                                  • {s.customer_name || 'کڕیاری گشتی'}
                                </span>
                              </div>
                              <span style={{ fontWeight: 800, color: 'var(--success-color)', fontSize: '0.9rem' }}>
                                {Number(s.total_amount).toLocaleString()} د.ع
                              </span>
                            </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                          هیچ پسووڵەیەک نەدۆزرایەوە
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Sale Items & Return Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', flex: 1, minHeight: 0 }}>
                  {/* Clean Invoice Header Banner */}
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                        پسووڵەی #{returnSearchedSale.id}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                        • {returnSearchedSale.customer_name || 'کڕیاری گشتی'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        ({Number(returnSearchedSale.total_amount).toLocaleString()} دینار)
                      </span>
                    </div>
                    <button
                      type="button"
                      id="return-choose-other-invoice-btn"
                      onClick={() => {
                        setReturnSearchedSale(null);
                        setReturnSelectedSaleItem(null);
                        setReturnSaleIdInput('');
                        setTimeout(() => returnInputRef.current?.focus(), 50);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary-color)',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        padding: '2px 6px'
                      }}
                    >
                      پسووڵەیەکی تر
                    </button>
                  </div>

                  {/* List of items in invoice with hide-scrollbar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      کاڵای گەڕاوە لەم پسووڵەیە دیاریبکە:
                    </label>
                    <div 
                      className="hide-scrollbar"
                      style={{ 
                        maxHeight: '230px', 
                        overflowY: 'auto', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '7px'
                      }}
                    >
                      {returnSearchedSale.items.map(it => {
                        const isSelected = returnSelectedSaleItem?.product_id === it.product_id;
                        const isOutOfStock = it.returnable_qty <= 0;
                        return (
                          <div
                            key={it.product_id}
                            onClick={() => {
                              if (isOutOfStock) return;
                              setReturnSelectedSaleItem(it);
                              setReturnQtyInput(it.returnable_qty); // Auto-select full returnable qty on click!
                            }}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                              border: isSelected ? '1.5px solid var(--primary-color)' : '1px solid var(--border-color)',
                              opacity: isOutOfStock ? 0.45 : 1,
                              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                {it.product_name}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>بڕی کڕدراو: {it.quantity} {it.unit || 'دانە'}</span>
                                {it.has_discount && (
                                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.78rem' }}>
                                    ({Number(it.effective_unit_price).toLocaleString()} د.ع بە داشکاندنەوە)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              {isOutOfStock ? (
                                <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>تەواوی گەڕاوەتەوە</span>
                              ) : (
                                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: isSelected ? 'var(--primary-color)' : 'var(--success-color)' }}>
                                  ماوە: {it.returnable_qty} {it.unit || 'دانە'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quantity Input for Selected Item (Clean, Minimalist, Decrement button ONLY) */}
                  {returnSelectedSaleItem && returnSelectedSaleItem.returnable_qty > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-tertiary)'
                    }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        بڕی گەڕێنراوە ({returnSelectedSaleItem.unit || 'دانە'}):
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          id="return-decrement-qty-btn"
                          disabled={(parseFloat(returnQtyInput) || 0) <= 1}
                          onClick={() => {
                            const cur = parseFloat(returnQtyInput) || 0;
                            if (cur > 1) {
                              setReturnQtyInput(Math.max(1, cur - 1));
                            }
                          }}
                          style={{ 
                            width: '38px', 
                            height: '38px', 
                            borderRadius: '8px', 
                            border: '1px solid var(--border-color)', 
                            background: (parseFloat(returnQtyInput) || 0) <= 1 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', 
                            color: (parseFloat(returnQtyInput) || 0) <= 1 ? 'var(--text-muted)' : 'var(--text-primary)', 
                            cursor: (parseFloat(returnQtyInput) || 0) <= 1 ? 'not-allowed' : 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            transition: 'all 0.15s ease'
                          }}
                          title="کەمکردنەوە"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          id="return-qty-input"
                          min="1"
                          max={returnSelectedSaleItem.returnable_qty}
                          step="any"
                          value={returnQtyInput}
                          onChange={(e) => handleReturnQtyChange(e.target.value, returnSelectedSaleItem.returnable_qty)}
                          style={{ 
                            width: '70px', 
                            height: '38px', 
                            textAlign: 'center', 
                            fontWeight: 800, 
                            fontSize: '1.15rem', 
                            borderRadius: '8px', 
                            border: '1px solid var(--border-color)', 
                            background: 'var(--bg-secondary)', 
                            color: 'var(--text-primary)', 
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Total Refund Summary with Accurate Proportional Discount */}
                  {returnSelectedSaleItem && returnSelectedSaleItem.returnable_qty > 0 && (() => {
                    const qty = parseFloat(returnQtyInput) || 0;
                    const originalPrice = Number(returnSelectedSaleItem.original_price_at_sale ?? returnSelectedSaleItem.price_at_sale ?? 0);
                    const effectivePrice = returnSelectedSaleItem.effective_unit_price !== undefined
                      ? Number(returnSelectedSaleItem.effective_unit_price)
                      : (
                          (Number(returnSearchedSale?.subtotal_amount) > 0 && Number(returnSearchedSale?.discount_amount) > 0)
                            ? Math.round(originalPrice * Math.max(0, Math.min(1, Number(returnSearchedSale.total_amount) / Number(returnSearchedSale.subtotal_amount))))
                            : originalPrice
                        );
                    
                    const isReturningAllRemainingOfInvoice = (
                      returnSearchedSale?.items?.length === 1 &&
                      qty >= Number(returnSelectedSaleItem.returnable_qty)
                    );

                    let computedRefund = 0;
                    if (isReturningAllRemainingOfInvoice && returnSearchedSale?.remaining_refundable_total !== undefined) {
                      computedRefund = Number(returnSearchedSale.remaining_refundable_total);
                    } else {
                      computedRefund = Math.round(effectivePrice * qty);
                      if (returnSearchedSale?.remaining_refundable_total !== undefined) {
                        computedRefund = Math.min(computedRefund, Number(returnSearchedSale.remaining_refundable_total));
                      }
                    }

                    const hasDiscount = returnSelectedSaleItem.has_discount || (Number(returnSearchedSale?.discount_amount) > 0);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '10px 14px', 
                          borderRadius: '10px', 
                          background: 'var(--bg-tertiary)' 
                        }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 600 }}>
                            کۆی پارەی گەڕاوە:
                          </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '1.25rem' }}>
                            {computedRefund.toLocaleString()} دینار
                          </span>
                        </div>

                        {/* Settlement Indicator for Cashier (DEBT vs CASH) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          background: returnSearchedSale.recommended_refund_method === 'DEBT' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          border: returnSearchedSale.recommended_refund_method === 'DEBT' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                          color: returnSearchedSale.recommended_refund_method === 'DEBT' ? '#ef4444' : '#10b981'
                        }}>
                          <span>شێوازی دانەوە:</span>
                          <span>
                            {returnSearchedSale.recommended_refund_method === 'DEBT'
                              ? `داشکاندن لە قەرزی ${returnSearchedSale.customer_name || 'کڕیار'} (نەقد مەدە)`
                              : 'دانەوەی نەقد لە سندوق'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action Button: ONLY rendered in Step 2 */}
                  <div style={{ marginTop: '0.2rem' }}>
                    <button 
                      type="submit" 
                      id="return-confirm-btn"
                      disabled={
                        !returnSearchedSale || 
                        !returnSelectedSaleItem || 
                        returnSelectedSaleItem.returnable_qty <= 0 || 
                        (parseFloat(returnQtyInput) || 0) <= 0 || 
                        (parseFloat(returnQtyInput) || 0) > returnSelectedSaleItem.returnable_qty || 
                        isExecutingReturn
                      }
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '10px', 
                        background: (returnSelectedSaleItem && returnSelectedSaleItem.returnable_qty > 0 && (parseFloat(returnQtyInput) || 0) <= returnSelectedSaleItem.returnable_qty) 
                          ? 'var(--primary-color)' 
                          : 'var(--bg-tertiary)', 
                        border: 'none', 
                        color: (returnSelectedSaleItem && returnSelectedSaleItem.returnable_qty > 0) ? '#ffffff' : 'var(--text-muted)', 
                        fontWeight: 800, 
                        fontSize: '1rem', 
                        cursor: (returnSelectedSaleItem && returnSelectedSaleItem.returnable_qty > 0 && !isExecutingReturn) ? 'pointer' : 'not-allowed', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isExecutingReturn ? 'دەگەڕێتەوە...' : 'گەڕاندنەوە'}
                    </button>
                  </div>
                </div>
              )}

            </form>
          </div>
        </div>
      )}

      {/* Scale / Weighted Item Modal (F3) - Minimalist & Clean */}
      {isScaleModalOpen && (
        <div 
          className="pos-modal-overlay" 
          onClick={() => { setIsScaleModalOpen(false); setIsScaleSearchOpen(false); }}
          style={{ backdropFilter: 'blur(5px)', background: 'rgba(0, 0, 0, 0.6)', zIndex: 1050 }}
        >
          <div 
            className="pos-modal-card no-scroll" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              padding: '1.6rem 2rem', 
              maxWidth: '560px', 
              width: '95%',
              borderRadius: '20px', 
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.35)',
              overflow: 'visible',
              direction: 'rtl'
            }}
          >
            {/* Header: Title and Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={20} style={{ color: 'var(--text-primary)' }} />
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  فرۆشتنی کاڵا بە کێش
                </h2>
              </div>
              <button 
                type="button"
                id="scale-modal-close-btn"
                onClick={() => { setIsScaleModalOpen(false); setIsScaleSearchOpen(false); }} 
                title="داخستن"
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer', 
                  width: '30px', 
                  height: '30px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}
              >
                <XIcon size={17} />
              </button>
            </div>

            <form onSubmit={handleAddScaleItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Product Selection with Click-Outside Ref */}
              <div ref={scaleDropdownRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.88rem' }}>
                  ناوی کاڵا
                </label>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    id="scale-product-search-input"
                    required
                    placeholder="ناوی کاڵا بنووسە..."
                    value={scaleItemName}
                    onChange={(e) => {
                      setScaleItemName(e.target.value);
                      setIsScaleSearchOpen(true);
                      setScaleSelectedProductId('');
                    }}
                    onFocus={() => setIsScaleSearchOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setIsScaleSearchOpen(false);
                      }
                    }}
                    style={{ 
                      width: '100%', 
                      padding: '11px 16px',
                      borderRadius: '10px',
                      background: 'var(--bg-tertiary)',
                      border: isScaleSearchOpen ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.94rem',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                  {scaleItemName && (
                    <button
                      type="button"
                      id="scale-clear-item-btn"
                      onClick={() => {
                        setScaleItemName('');
                        setScalePricePerKg('');
                        setScaleAmount('');
                        setScaleSelectedProductId('');
                        setIsScaleSearchOpen(true);
                      }}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <XIcon size={14} />
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {isScaleSearchOpen && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      left: 0,
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
                      maxHeight: '170px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      padding: '4px'
                    }}
                  >
                    {filteredScaleProducts.length > 0 ? (
                      filteredScaleProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectScaleProduct(p)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            fontSize: '0.85rem'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                          <span style={{ color: 'var(--success-color)', fontWeight: 700, fontSize: '0.82rem' }}>
                            {Number(p.selling_price).toLocaleString()} د.ع / کگم
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                        هیچ کاڵایەک نەدۆزرایەوە
                      </div>
                    )}
                  </div>
                )}

                {/* Read-Only Price (Rule 2: Default to 0, never 'دیاری نەکراوە') */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '0.45rem',
                  padding: '2px 4px',
                  fontSize: '0.84rem'
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    نرخی ١ کیلۆ:
                  </span>
                  <span style={{ color: scalePricePerKg ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 800 }}>
                    {scalePricePerKg ? Number(scalePricePerKg).toLocaleString() : '0'} دینار
                  </span>
                </div>
              </div>

              {/* Two Main Inputs: بڕی پارە & کێش (Rule 3: Clean, perfectly aligned horizontally) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
                
                {/* Field 1: بڕی پارە */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                    بڕی پارە (دینار)
                  </label>
                  <input 
                    type="number"
                    id="scale-amount-input"
                    step="50"
                    min="0"
                    placeholder="0"
                    value={scaleAmount}
                    onChange={(e) => handleScaleAmountChange(e.target.value)}
                    onFocus={(e) => { e.target.select(); setIsScaleSearchOpen(false); }}
                    style={{
                      width: '100%',
                      height: '48px',
                      padding: '11px',
                      borderRadius: '10px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Field 2: کێش */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                    کێش (گرام)
                  </label>
                  <input 
                    type="number"
                    id="scale-weight-input"
                    step="1"
                    min="1"
                    placeholder="0"
                    value={scaleWeight}
                    onChange={(e) => handleScaleWeightChange(e.target.value)}
                    onFocus={(e) => { e.target.select(); setIsScaleSearchOpen(false); }}
                    style={{
                      width: '100%',
                      height: '48px',
                      padding: '11px',
                      borderRadius: '10px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Summary (Rule 5: Clean single line) */}
              {(() => {
                const pKg = parseFloat(scalePricePerKg) || 0;
                const rawW = parseFloat(scaleWeight) || 0;
                const wInKg = rawW / 1000;
                const totalAmt = scaleAmount ? parseFloat(scaleAmount) : Math.round(pKg * wInKg);
                return (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '9px 12px', 
                    borderRadius: '10px', 
                    background: 'var(--bg-tertiary)' 
                  }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                      کۆی گشتی:
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '1.25rem' }}>
                      {(totalAmt || 0).toLocaleString()} دینار
                    </span>
                  </div>
                );
              })()}

              {/* Full Width Call to Action Button */}
              <button 
                type="submit" 
                id="scale-add-to-cart-btn"
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  background: 'var(--primary-color)', 
                  color: 'white', 
                  border: 'none', 
                  fontWeight: 800, 
                  fontSize: '1rem', 
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease'
                }}
              >
                خستنە ناو سەبەتە
              </button>

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
                <span>زیادکردنی خێرای کڕیار</span>
              </h2>
              <button onClick={() => setIsQuickCustomerModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>✕</span>
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
                  step="any"
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
                <span>بارکۆدی تۆمارنەکراو</span>
              </h2>
              <button onClick={() => setIsUncataloguedModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>✕</span>
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
                    step="any"
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

      {/* Recent Sales Modal (دوایین فرۆشتنەکان) */}
      {isRecentSalesOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsRecentSalesOpen(false)}>
          <div className="pos-modal-card no-scroll" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', width: '95%', padding: '1.25rem 1.4rem' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>دوایین فرۆشتنەکان</h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>١٠ وەسڵی کۆتایی ئەنجامدراو لە سیستەمدا</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleOpenRecentSales}
                  title="نوێکردنەوە"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>↻</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsRecentSalesOpen(false)} 
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>✕</span>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            {isLoadingRecentSales ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                چاوەڕوانبە، خەریکی هێنانی زانیارییەکانە...
              </div>
            ) : recentSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                هیچ فرۆشتنێکی پێشوو تۆمار نەکراوە
              </div>
            ) : (
              <div style={{ borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700, width: '11%' }}># وەسڵ</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, width: '22%' }}>کات و بەروار</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, width: '24%' }}>کڕیار</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, width: '13%', textAlign: 'center' }}>شێواز</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, width: '18%' }}>کۆی گشتی</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, width: '12%', textAlign: 'center' }}>کردار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale, index) => {
                      const isReprinting = isReprintingSaleId === sale.id;
                      const methodLabel = sale.payment_method === 'DEBT' 
                        ? 'قەرز' 
                        : (sale.payment_method === 'SPLIT' ? 'تێکەڵ' : 'نەقد');
                      const methodColor = sale.payment_method === 'DEBT' 
                        ? '#ef4444' 
                        : (sale.payment_method === 'SPLIT' ? '#f59e0b' : '#10b981');
                      const methodBg = sale.payment_method === 'DEBT' 
                        ? 'rgba(239, 68, 68, 0.12)' 
                        : (sale.payment_method === 'SPLIT' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)');

                      return (
                        <tr 
                          key={sale.id}
                          style={{
                            borderBottom: index === recentSales.length - 1 ? 'none' : '1px solid var(--border-color)',
                            background: index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                            transition: 'background 0.12s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'}
                        >
                          {/* Sale ID */}
                          <td style={{ padding: '6px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            #{sale.id}
                          </td>

                          {/* Date & Time */}
                          <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            {formatDateTime(sale.created_at, { twelveHour: true })}
                          </td>

                          {/* Customer */}
                          <td style={{ padding: '6px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {sale.customer_name || 'کڕیاری گشتی'}
                          </td>

                          {/* Payment Method */}
                          <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontWeight: 700, 
                              background: methodBg, 
                              color: methodColor,
                              display: 'inline-block'
                            }}>
                              {methodLabel}
                            </span>
                          </td>

                          {/* Total Amount */}
                          <td style={{ padding: '6px 12px', fontWeight: 800, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                            {Number(sale.total_amount || 0).toLocaleString()} د.ع
                          </td>

                          {/* Action (Reprint) */}
                          <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleReprintRecentSale(sale.id)}
                              disabled={isReprinting}
                              title="چاپکردنەوەی ئەم پسووڵەیە"
                              style={{
                                padding: '3px 10px',
                                borderRadius: '5px',
                                background: 'rgba(2, 132, 199, 0.12)',
                                color: '#0284c7',
                                border: '1px solid rgba(2, 132, 199, 0.35)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: isReprinting ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.12s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (!isReprinting) {
                                  e.currentTarget.style.background = '#0284c7';
                                  e.currentTarget.style.color = '#ffffff';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isReprinting) {
                                  e.currentTarget.style.background = 'rgba(2, 132, 199, 0.12)';
                                  e.currentTarget.style.color = '#0284c7';
                                }
                              }}
                            >
                              {isReprinting ? '...' : 'چاپکردنەوە'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}


          </div>
        </div>
      )}

    </div>
  );
};

export default Cashier;