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
  Tag,
  Package
} from 'lucide-react';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import './Dashboard.css';

const Cashier = () => {
  const navigate = useNavigate();
  // Multi-Cart State (Cart 1: Main, Cart 2: Quick-Sell)
  const [activeCartIndex, setActiveCartIndex] = useState(0);
  const [carts, setCarts] = useState([
    { id: 1, label: 'سەلە ١ (سەرەکی)', shortcut: 'F6', items: [], customerId: '', discountType: 'AMOUNT', discountValue: '', paymentMode: 'CASH', splitCashAmount: '' },
    { id: 2, label: 'سەلە ٢ (خێرا)', shortcut: 'F7', items: [], customerId: '', discountType: 'AMOUNT', discountValue: '', paymentMode: 'CASH', splitCashAmount: '' }
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

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Receipt Print State
  const [printedReceipt, setPrintedReceipt] = useState(null);
  const [autoPrint, setAutoPrint] = useState(() => {
    return localStorage.getItem('pos_auto_print') === 'true';
  });
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

  // Global Keyboard Shortcuts (F1, F2, F3, F4, F9, Escape)
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
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isCheckingOut) {
          handleCheckout();
        }
      } else if (e.key === 'Escape') {
        setIsQuickItemModalOpen(false);
        setIsScaleModalOpen(false);
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
    if (isNaN(qty) || qty <= 0) return;
    const roundedQty = Math.round(qty * 1000) / 1000;
    setCart(prev => prev.map(item => (item.cartKey === key || item.barcode === key) ? { ...item, quantity: roundedQty } : item));
  };

  const removeFromCart = (key) => {
    setCart(prev => prev.filter(item => item.cartKey !== key && item.barcode !== key));
  };

  const clearCart = () => {
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
    const scaleItem = {
      id: `scale_${Date.now()}`,
      name: `${name} (${weight} کگم)`,
      barcode: `SCALE_${Date.now()}`,
      price: pricePerKg,
      selling_price: pricePerKg,
      stock: 999,
      quantity: weight,
      is_custom: true,
      is_weighted: true,
      unit: 'کگم'
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

  // Barcode Handler (Hardware wedge + manual input)
  const handleProcessBarcode = (code) => {
    if (!code) return;
    const cleanCode = code.trim();

    // 1. Check if barcode matches a carton/box barcode directly
    const productBox = products.find(p => p.box_barcode && String(p.box_barcode).trim() === cleanCode);
    // 2. Check if barcode matches a single piece barcode
    const productPiece = products.find(p => String(p.barcode).trim() === cleanCode);

    if (productBox) {
      // Scanned carton barcode -> Directly add as BOX with wholesale price and box units deduction
      addToCart(productBox, 1, 'BOX');
    } else if (productPiece) {
      // Scanned regular piece barcode
      addToCart(productPiece, 1, 'PIECE');
    } else {
      alert(`کاڵاکە نەدۆزرایەوە بۆ ئەم بارکۆدە: ${cleanCode}`);
    }
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (barcodeInput) {
      handleProcessBarcode(barcodeInput);
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

        // Only print if requested
        if (shouldPrint) {
          if (window.require) {
            try {
              const { ipcRenderer } = window.require('electron');
              ipcRenderer.send('print-receipt', receiptData);
            } catch (_) {}
          } else {
            setTimeout(() => {
              window.print();
            }, 150);
          }
        }

        alert(`فرۆشتن بە سەرکەوتوویی ئەنجامدرا! کۆی گشتی: ${grandTotal.toLocaleString()} دینار`);
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
      const matchesSearch = 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
        p.barcode.includes(productSearch);

      const matchesCat = 
        selectedCategoryId === 'ALL' || 
        String(p.category_id) === String(selectedCategoryId);

      return matchesSearch && matchesCat;
    });
  }, [products, productSearch, selectedCategoryId]);

  return (
    <div className="dashboard-page p-6" style={{ position: 'relative' }}>
      
      {/* Thermal Print Receipt Style */}
      <style>{`
        @media print {
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
            padding: 10px !important;
            font-family: monospace !important;
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

      {/* Keyboard Shortcuts Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        padding: '10px 18px',
        marginBottom: '1.25rem',
        fontSize: '0.85rem',
        color: '#94a3b8',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 'bold' }}>
          <Keyboard size={18} /> کورتکراوەکانی کیبۆرد بۆ خێرایی:
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span><kbd style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '5px', color: '#fff', fontWeight: 'bold' }}>F1</kbd> بارکۆد</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '5px', color: '#fff', fontWeight: 'bold' }}>F2</kbd> کاڵای دەستی</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '5px', color: '#fff', fontWeight: 'bold' }}>F3</kbd> کێش/تەرازوو ⚖️</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '5px', color: '#fff', fontWeight: 'bold' }}>F4</kbd> داشکاندن %</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '5px', color: '#fff', fontWeight: 'bold' }}>F9</kbd> پارەدان و چاپ ⚡</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: '5px', color: '#fff', fontWeight: 'bold' }}>Esc</kbd> داخستن</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => navigate('/shifts')}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'rgba(16, 185, 129, 0.2)', 
              color: '#34d399', 
              border: '1px solid rgba(16, 185, 129, 0.4)', 
              borderRadius: '8px', 
              padding: '5px 12px', 
              fontSize: '0.82rem', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            <Lock size={14} /> قاسە و شیفت
          </button>

          <button 
            type="button" 
            onClick={() => navigate('/promotions')}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'rgba(168, 85, 247, 0.2)', 
              color: '#c084fc', 
              border: '1px solid rgba(168, 85, 247, 0.4)', 
              borderRadius: '8px', 
              padding: '5px 12px', 
              fontSize: '0.82rem', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            <Tag size={14} /> ئۆفەرەکان
          </button>
        </div>
      </div>

      {/* Main Layout: Left Products & Barcode Scanner, Right Interactive Cart */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Left Side: Products Catalog & Scan Input */}
        <div style={{ flex: '1 1 58%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Top Barcode Input & Search Header */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '16px', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={handleBarcodeSubmit} style={{ flex: '1 1 280px', display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <ScanBarcode size={20} color="#38bdf8" style={{ position: 'absolute', right: '12px', top: '12px' }} />
                <input 
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="سکانکردنی بارکۆد بە ئامێر (F1)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  autoFocus
                  style={{ width: '100%', padding: '10px 42px 10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(56, 189, 248, 0.35)', color: 'white', fontFamily: 'monospace', fontSize: '1rem' }}
                />
              </div>
              <button 
                type="submit" 
                style={{ padding: '0 18px', borderRadius: '10px', background: '#38bdf8', color: '#0f172a', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
              >
                سکان
              </button>
            </form>

            <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Search size={16} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="گەڕان بە ناوی کاڵا..." 
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'white', marginRight: '8px', outline: 'none', width: '100%', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {/* Category Quick Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedCategoryId('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: selectedCategoryId === 'ALL' ? 'bold' : 'normal',
                background: selectedCategoryId === 'ALL' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                color: selectedCategoryId === 'ALL' ? 'white' : '#94a3b8',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
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
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: isActive ? 'bold' : 'normal',
                    background: isActive ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                    color: isActive ? 'white' : '#94a3b8',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Quick Products Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '12px', maxHeight: 'calc(100vh - 270px)', minHeight: '440px', overflowY: 'auto', padding: '4px' }}>
            {filteredProducts.map(p => {
              const promo = activePromotions[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p, 1)}
                  className="glass-panel"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: promo ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                    background: promo ? 'linear-gradient(180deg, rgba(168, 85, 247, 0.12) 0%, rgba(30, 41, 59, 0.6) 100%)' : 'rgba(30, 41, 59, 0.6)',
                    color: 'white',
                    textAlign: 'right',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s',
                    minHeight: '128px',
                    height: 'auto',
                    gap: '10px'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = promo ? '#c084fc' : '#38bdf8'}
                  onMouseOut={e => e.currentTarget.style.borderColor = promo ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255,255,255,0.08)'}
                >
                  <div>
                    <div style={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.92rem', 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical', 
                      overflow: 'hidden', 
                      lineHeight: '1.35',
                      minHeight: '2.7em',
                      wordBreak: 'break-word'
                    }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: p.stock <= 0 ? '#f59e0b' : '#64748b', marginTop: '3px', fontWeight: p.stock <= 0 ? 'bold' : 'normal' }}>
                      کۆگا: {p.stock} {p.unit || 'دانە'} {p.stock <= 0 ? '(تەواوبوو)' : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '6px' }}>
                    {promo ? (
                      <div>
                        <span style={{ color: '#c084fc', fontWeight: 'bold', fontSize: '0.98rem', display: 'block', lineHeight: '1.2' }}>
                          {promo.promo_price.toLocaleString()} د.ع 🏷️
                        </span>
                        <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                          {Number(p.selling_price).toLocaleString()} د.ع
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.98rem' }}>
                        {Number(p.selling_price).toLocaleString()} د.ع
                      </span>
                    )}

                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ 
                        background: promo ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.15)', 
                        color: promo ? '#c084fc' : '#38bdf8', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontSize: '0.72rem', 
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}>
                        {promo && promo.max_qty_per_sale ? `سنوور: ${promo.max_qty_per_sale}` : `+١ ${p.unit || 'دانە'}`}
                      </span>

                      {(p.units_per_box > 1 || p.wholesale_price > 0) && (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p, 1, 'BOX');
                          }}
                          title={`زیادکردنی ١ کارتۆن (${p.units_per_box || 1} دانە) بە نرخی ${Number(p.wholesale_price).toLocaleString()} د.ع`}
                          style={{
                            background: 'rgba(168, 85, 247, 0.25)',
                            border: '1px solid rgba(168, 85, 247, 0.5)',
                            color: '#c084fc',
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer'
                          }}
                        >
                          📦 کارتۆن
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* Right Side: Interactive Cart & Direct Checkout */}
        <div style={{ flex: '1 1 38%', minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            
            {/* Cart Header with Quick Tool Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart color="#38bdf8" size={22} /> عەرەبانەی فرۆشتن
                {cart.length > 0 && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>({cart.length})</span>}
              </h2>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  onClick={() => setIsScaleModalOpen(true)}
                  title="تەرازوو و فرۆشتنی بە کێش (F3)"
                  style={{ padding: '6px 12px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#ffffff', border: 'none', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)' }}
                >
                  <Scale size={15} /> تەرازوو ⚖️
                </button>

                <button 
                  type="button"
                  onClick={() => setIsQuickItemModalOpen(true)}
                  title="کاڵای دەستی بێ بارکۆد (F2)"
                  style={{ padding: '6px 12px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', border: 'none', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)' }}
                >
                  <Zap size={15} /> کاڵای دەستی ⚡
                </button>

                {cart.length > 0 && (
                  <button 
                    onClick={clearCart}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={14} /> سڕینەوە
                  </button>
                )}
              </div>
            </div>

            {/* Multi-Cart Tabs Bar (Quick Sell / Parallel Customers) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: isActive ? '1.5px solid #38bdf8' : (hasItems ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent'),
                      background: isActive 
                        ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.35))' 
                        : (hasItems ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.02)'),
                      color: isActive ? '#38bdf8' : (hasItems ? '#f59e0b' : '#94a3b8'),
                      fontWeight: isActive ? 'bold' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isActive ? '0 4px 12px rgba(56, 189, 248, 0.25)' : 'none'
                    }}
                    title={`سویچ بکە بۆ ${c.label} (${c.shortcut})`}
                  >
                    <span style={{ fontSize: '0.95rem' }}>{c.label}</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '2px 8px', 
                      borderRadius: '10px',
                      background: isActive 
                        ? 'rgba(56, 189, 248, 0.3)' 
                        : (hasItems ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.06)'),
                      color: isActive ? '#ffffff' : (hasItems ? '#f59e0b' : '#64748b'),
                      fontWeight: 'bold'
                    }}>
                      {itemCount > 0 ? `${itemCount} کاڵا` : c.shortcut}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Customer & Payment Mode Selection */}
            <div style={{ marginBottom: '1rem', padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold' }}>
                  کڕیار (بۆ قەرز یان داشکاندن):
                </label>
                {selectedCustomer && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                    قەرزی پێشوو: {Number(selectedCustomer.total_debt || 0).toLocaleString()} د.ع
                  </span>
                )}
              </div>

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
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.9rem', outline: 'none' }}
              >
                <option value="">کڕیاری گشتی (نەقد)...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} - قەرز: {Number(c.total_debt || 0).toLocaleString()} دینار
                  </option>
                ))}
              </select>

              {/* Payment Mode Selector Tabs (CASH, DEBT, SPLIT) */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>شێوازی پارەدان:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode('CASH');
                      setSplitCashAmount('');
                    }}
                    style={{
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: paymentMode === 'CASH' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                      background: paymentMode === 'CASH' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: paymentMode === 'CASH' ? '#10b981' : '#94a3b8',
                      fontWeight: paymentMode === 'CASH' ? 'bold' : 'normal',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    💵 نەقد
                  </button>

                  <button
                    type="button"
                    disabled={!selectedCustomerId}
                    onClick={() => {
                      if (!selectedCustomerId) return;
                      setPaymentMode('DEBT');
                      setSplitCashAmount('');
                    }}
                    style={{
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: paymentMode === 'DEBT' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                      background: paymentMode === 'DEBT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: !selectedCustomerId ? '#64748b' : (paymentMode === 'DEBT' ? '#ef4444' : '#94a3b8'),
                      fontWeight: paymentMode === 'DEBT' ? 'bold' : 'normal',
                      fontSize: '0.8rem',
                      cursor: !selectedCustomerId ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    title={!selectedCustomerId ? 'تکایە سەرەتا کڕیار دیاریبکە' : ''}
                  >
                    💳 قەرز
                  </button>

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
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: paymentMode === 'SPLIT' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                      background: paymentMode === 'SPLIT' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: !selectedCustomerId ? '#64748b' : (paymentMode === 'SPLIT' ? '#f59e0b' : '#94a3b8'),
                      fontWeight: paymentMode === 'SPLIT' ? 'bold' : 'normal',
                      fontSize: '0.8rem',
                      cursor: !selectedCustomerId ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    title={!selectedCustomerId ? 'تکایە سەرەتا کڕیار دیاریبکە' : ''}
                  >
                    ⚖️ تێکەڵ (نەقد+قەرز)
                  </button>
                </div>
              </div>

              {/* Interactive Split Payment Calculator */}
              {paymentMode === 'SPLIT' && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '10px', border: '1px dashed rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>
                      بڕی پارەی نەقد (کاش):
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitCashAmount(String(Math.round(grandTotal / 2)))}
                      style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', cursor: 'pointer' }}
                    >
                      ٥٠٪ (نیوە)
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      step="250"
                      value={splitCashAmount}
                      placeholder="بڕی نەقد بنووسە..."
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', background: '#0f172a', border: '1px solid #f59e0b', color: '#10b981', fontSize: '1rem', fontWeight: 'bold', outline: 'none' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>دینار</span>
                  </div>

                  {/* Realtime Split Breakdown */}
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#10b981' }}>💵 نەقد: {effectiveCashPaid.toLocaleString()} د.ع</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ ماوە بە قەرز: {effectiveDebtAmount.toLocaleString()} د.ع</span>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Items List with Decimal & Multipliers */}
            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '35px 10px', color: '#94a3b8' }}>
                  <ShoppingCart size={40} style={{ opacity: 0.2, margin: '0 auto 10px auto' }} />
                  عەرەبانەی کڕین واڵایە.<br/>کاڵایەک سکان بکە یان کلیک بکە لە خشتەکە.
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
                        padding: '12px',
                        borderRadius: '12px',
                        background: item.unit_type === 'BOX' ? 'rgba(168, 85, 247, 0.12)' : (pricing.hasPromo ? 'rgba(168, 85, 247, 0.08)' : 'rgba(0,0,0,0.2)'),
                        border: item.unit_type === 'BOX' ? '1px solid rgba(168, 85, 247, 0.4)' : (pricing.hasPromo ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255,255,255,0.05)'),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {item.name}
                            {item.is_custom && (
                              <span style={{ fontSize: '0.72rem', background: isKg ? 'rgba(139, 92, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: isKg ? '#c084fc' : '#f59e0b', padding: '1px 6px', borderRadius: '4px' }}>
                                {isKg ? '⚖️ بە کێش' : 'دەستی'}
                              </span>
                            )}
                            {item.unit_type === 'BOX' && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.25)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.5)', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Package size={11} /> کارتۆن ({item.units_per_box || 1} دانە)
                              </span>
                            )}
                            {pricing.hasPromo && item.unit_type !== 'BOX' && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.25)', color: '#c084fc', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                🏷️ ئۆفەر
                              </span>
                            )}
                          </div>

                          {/* Promotional Tiered Explanation */}
                          {pricing.hasPromo && item.unit_type !== 'BOX' ? (
                            <div style={{ marginTop: '4px' }}>
                              {pricing.regularQty > 0 ? (
                                <div style={{ fontSize: '0.78rem', color: '#c084fc' }}>
                                  {pricing.promoQty} بە {pricing.promoPrice.toLocaleString()} د.ع (ئۆفەر) + {pricing.regularQty} بە {pricing.regularPrice.toLocaleString()} د.ع (ئاسایی)
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.8rem', color: '#a78bfa' }}>
                                  {pricing.promoPrice.toLocaleString()} دینار (ئۆفەر)
                                </div>
                              )}
                              {pricing.totalSavings > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 'bold', display: 'block', marginTop: '2px' }}>
                                  پاشەکەوت: {pricing.totalSavings.toLocaleString()} دینار 🏷️
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              {item.price.toLocaleString()} دینار بۆ هەر {item.unit || 'دانە'}
                              {item.unit_type === 'BOX' && (
                                <span style={{ color: '#c084fc', marginRight: '6px' }}>
                                  (تێچووی کۆگایی: {item.units_per_box || 1} دانە بە کۆ)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 'bold', color: item.unit_type === 'BOX' ? '#c084fc' : '#10b981', fontSize: '1rem' }}>
                            {lineTotal.toLocaleString()} دینار
                          </div>
                          <button 
                            onClick={() => removeFromCart(itemKey)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', marginTop: '2px' }}
                            title="سڕینەوە"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Quantity Stepper & Unit Switcher & Quick Multipliers */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        
                        {/* Stepper +/- */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                          <button 
                            onClick={() => updateQuantity(itemKey, Math.max(0.1, item.quantity - (isKg ? 0.25 : 1)))}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={14} />
                          </button>
                          
                          <input 
                            type="number" 
                            step={isKg ? '0.05' : '1'}
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(itemKey, e.target.value)}
                            style={{ width: '60px', textAlign: 'center', background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold', fontSize: '0.9rem' }}
                          />

                          <button 
                            onClick={() => updateQuantity(itemKey, item.quantity + (isKg ? 0.25 : 1))}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Unit Switcher: دانە vs کارتۆن */}
                        {(item.units_per_box > 1 || item.wholesale_price > 0 || item.unit_type === 'BOX') && (
                          <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.35)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(168, 85, 247, 0.35)' }}>
                            <button
                              type="button"
                              onClick={() => setItemUnitType(itemKey, 'PIECE')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.74rem',
                                fontWeight: 'bold',
                                background: item.unit_type !== 'BOX' ? '#38bdf8' : 'transparent',
                                color: item.unit_type !== 'BOX' ? '#0f172a' : '#94a3b8'
                              }}
                            >
                              دانە 🏷️
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemUnitType(itemKey, 'BOX')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.74rem',
                                fontWeight: 'bold',
                                background: item.unit_type === 'BOX' ? '#c084fc' : 'transparent',
                                color: item.unit_type === 'BOX' ? '#0f172a' : '#94a3b8'
                              }}
                            >
                              کارتۆن 📦 ({item.units_per_box || 1})
                            </button>
                          </div>
                        )}

                        {/* Quick Presets Buttons */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(isKg ? [0.25, 0.5, 1, 2] : [1, 5, 10, 20]).map(q => (
                            <button
                              key={q}
                              onClick={() => updateQuantity(itemKey, q)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: Number(item.quantity) === q ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                                color: Number(item.quantity) === q ? '#0f172a' : '#94a3b8',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
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

            {/* Discount Section (داشکاندن بە بڕ یان ڕێژە) */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Percent size={15} /> داشکاندن (تەخفیف):
                </span>
                
                {/* Discount Type Toggle */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setDiscountType('AMOUNT')}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      background: discountType === 'AMOUNT' ? '#8b5cf6' : 'transparent',
                      color: discountType === 'AMOUNT' ? 'white' : '#94a3b8',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    دینار (بڕ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENT')}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      background: discountType === 'PERCENT' ? '#8b5cf6' : 'transparent',
                      color: discountType === 'PERCENT' ? 'white' : '#94a3b8',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    ڕێژەی %
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  ref={discountInputRef}
                  type="number"
                  min="0"
                  placeholder={discountType === 'PERCENT' ? 'ڕێژەی داشکاندن بنووسە (بۆ نموونە: ١٠ بۆ ١٠%)...' : 'بڕی داشکاندن بە دینار (بۆ نموونە: ٥٠٠)...'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139, 92, 246, 0.3)', color: 'white', fontSize: '0.9rem' }}
                />
                {calculatedDiscount > 0 && (
                  <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    -{calculatedDiscount.toLocaleString()} دینار
                  </span>
                )}
              </div>
            </div>

            {/* Cart Footer: Totals & Checkout Button */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem' }}>
              
              {/* Subtotal & Discount Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>کۆی سەرەتایی:</span>
                  <span>{subtotal.toLocaleString()} دینار</span>
                </div>

                {totalPromotionalSavings > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c084fc', fontWeight: 'bold' }}>
                    <span>پاشەکەوتی ئۆفەرەکان:</span>
                    <span>-{totalPromotionalSavings.toLocaleString()} دینار 🏷️</span>
                  </div>
                )}

                {calculatedDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                    <span>داشکاندنی پسووڵە:</span>
                    <span>-{calculatedDiscount.toLocaleString()} دینار</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>کۆی کۆتایی:</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: paymentMode === 'DEBT' ? '#ef4444' : (paymentMode === 'SPLIT' ? '#f59e0b' : '#10b981') }}>
                  {grandTotal.toLocaleString()} دینار
                </span>
              </div>

              {paymentMode === 'DEBT' && (
                <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
                  ⚠️ ئەم بڕە دەچێتە سەر قەرزی: {selectedCustomer?.name}
                </div>
              )}

              {paymentMode === 'SPLIT' && (
                <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', color: '#f59e0b', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid rgba(245, 158, 11, 0.25)', textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>⚖️ فرۆشتنی فرە-جۆر (تێکەڵ):</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                    💵 نەقد: <strong style={{ color: '#10b981' }}>{effectiveCashPaid.toLocaleString()} د.ع</strong> | 
                    ⚠️ قەرز: <strong style={{ color: '#ef4444' }}>{effectiveDebtAmount.toLocaleString()} د.ع</strong>
                  </div>
                </div>
              )}

              {/* Auto-Print Preference Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#94a3b8', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={autoPrint}
                    onChange={(e) => {
                      setAutoPrint(e.target.checked);
                      localStorage.setItem('pos_auto_print', e.target.checked ? 'true' : 'false');
                    }}
                    style={{ width: '16px', height: '16px', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  <span>چاپی خۆکاری وەسڵ</span>
                </label>
                <span style={{ fontSize: '0.75rem', color: autoPrint ? '#10b981' : '#64748b' }}>
                  {autoPrint ? 'چالاکە ✓' : 'ناچالاکە ✕'}
                </span>
              </div>

              {/* Dual Action Buttons: Fast Sale vs Sale & Print */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  onClick={() => handleCheckout(false)}
                  disabled={isCheckingOut || cart.length === 0}
                  style={{
                    padding: '14px 10px',
                    borderRadius: '12px',
                    background: cart.length === 0 ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #0284c7, #2563eb)',
                    color: cart.length === 0 ? '#64748b' : 'white',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: cart.length === 0 ? 'none' : '0 4px 12px rgba(37,99,235,0.3)'
                  }}
                >
                  <Zap size={18} />
                  {isCheckingOut ? '...' : 'فرۆشتن بێ چاپ'}
                </button>

                <button
                  onClick={() => handleCheckout(true)}
                  disabled={isCheckingOut || cart.length === 0}
                  style={{
                    padding: '14px 10px',
                    borderRadius: '12px',
                    background: cart.length === 0 
                      ? 'rgba(255,255,255,0.08)' 
                      : (paymentMode === 'DEBT' ? '#ef4444' : (paymentMode === 'SPLIT' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)')),
                    color: cart.length === 0 ? '#64748b' : 'white',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: cart.length === 0 
                      ? 'none' 
                      : (paymentMode === 'DEBT' ? '0 4px 12px rgba(239,68,68,0.3)' : (paymentMode === 'SPLIT' ? '0 4px 12px rgba(245,158,11,0.3)' : '0 4px 12px rgba(16,185,129,0.3)'))
                  }}
                >
                  <Printer size={18} />
                  {isCheckingOut ? '...' : 'پارەدان و چاپ (F9)'}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#7c3aed' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>
                <Zap color="#f59e0b" /> فرۆشتنی کاڵای دەستی / خێرا (F2)
              </h2>
              <button onClick={() => setIsQuickItemModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={22}/>
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              بۆ ئەو کاڵایانەی بێ بارکۆدن یان لە سیستەم تۆمار نەکراون، نرخ بنووسە و ڕاستەوخۆ بیخەرە ناو عەرەبانە.
            </p>

            <form onSubmit={handleAddQuickCustomItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>ناوی کاڵا (ئارەزوومەندانە)</label>
                <input 
                  type="text" 
                  placeholder="کاڵای دەستی / گشتی..."
                  value={quickItemName}
                  onChange={(e) => setQuickItemName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#10b981', fontWeight: 'bold' }}>
                  نرخی فرۆشتن (دینار) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="number" 
                  required
                  autoFocus
                  placeholder="بۆ نموونە: ٢٥٠٠"
                  value={quickItemPrice}
                  onChange={(e) => setQuickItemPrice(e.target.value)}
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>بڕ (دانە)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    min="1"
                    value={quickItemQty}
                    onChange={(e) => setQuickItemQty(e.target.value)}
                    style={{ width: '80px', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold', textAlign: 'center' }}
                  />
                  {[1, 2, 3, 5, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setQuickItemQty(cnt.toString())}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: quickItemQty === cnt.toString() ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                        color: quickItemQty === cnt.toString() ? '#0f172a' : '#94a3b8',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}
                >
                  خستنە ناو سەبەتە 🛒
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsQuickItemModalOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>
                <Scale color="#8b5cf6" /> تەرازوو و سەوزە و میوە بە کێش (F3)
              </h2>
              <button onClick={() => setIsScaleModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={22}/>
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              دیاریکردنی نرخی کیلۆ و کێش (بە کیلۆگرام یان گرام) بۆ ئەژمارکردنی خێرای سەوزە و میوە.
            </p>

            <form onSubmit={handleAddScaleItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Optional: Pick from existing products */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>هەڵبژاردن لە کاڵاکان (ئارەزوومەندانە):</label>
                <select 
                  value={scaleSelectedProductId}
                  onChange={(e) => handleSelectProductForScale(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
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
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>ناوی کاڵا / سەوزە / میوە <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="بۆ نموونە: تەماتە، خەیار، پەتاتە..."
                  value={scaleItemName}
                  onChange={(e) => setScaleItemName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#10b981', fontWeight: 'bold' }}>
                  نرخی یەک کیلۆ (دینار) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="number" 
                  required
                  placeholder="بۆ نموونە: ١٠٠٠"
                  value={scalePricePerKg}
                  onChange={(e) => setScalePricePerKg(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#c084fc', fontWeight: 'bold' }}>
                  کێش (بە کیلۆگرام - کگم) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    step="0.001"
                    min="0.001"
                    required
                    value={scaleWeight}
                    onChange={(e) => setScaleWeight(e.target.value)}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c084fc', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}
                  />
                  <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>کگم</span>
                </div>

                {/* Quick Weight Presets */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '٢٥٠ گرام (چارەکە)', val: '0.250' },
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
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: scaleWeight === w.val ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                        color: scaleWeight === w.val ? 'white' : '#94a3b8',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
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
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>کۆی پارەی کێشەکە: </span>
                  <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.3rem' }}>
                    {Math.round((parseFloat(scalePricePerKg) || 0) * (parseFloat(scaleWeight) || 0)).toLocaleString()} دینار
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}
                >
                  خستنە ناو سەبەتە ⚖️
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsScaleModalOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
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