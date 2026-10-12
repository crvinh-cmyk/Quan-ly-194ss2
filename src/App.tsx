import React, { useState, useEffect, useMemo } from 'react';
import { Product, Customer, Order, OrderStatus, WorkshopInfo, Material, StockImportReceipt, StudioCombo, InkImportRecord } from './types';
import { calculateCustomerDebt } from './utils/storage';
import {
  subscribeProducts, saveProductToFirestore, deleteProductFromFirestore,
  subscribeCustomers, saveCustomerToFirestore, deleteCustomerFromFirestore,
  subscribeOrders, saveOrderToFirestore, deleteOrderFromFirestore, saveOrUpdateOrderWithInventoryTransaction,
  subscribeMaterials, saveMaterialToFirestore, deleteMaterialFromFirestore,
  subscribeStockImports, saveStockImportToFirestore, deleteStockImportFromFirestore, clearAllPurchasesFromFirestore,
  subscribeCombos, saveComboToFirestore, deleteComboFromFirestore,
  subscribeWorkshopInfo, saveWorkshopInfoToFirestore,
  subscribeInkImports, saveInkImportToFirestore, deleteInkImportFromFirestore, resetInkYearInFirestore,
  AuthUserContext
} from './services/firestoreService';
import { subscribeAuthState, logoutUser } from './services/authService';
import { User } from 'firebase/auth';
import { DEFAULT_WORKSHOP_INFO, DEFAULT_MATERIALS } from './data/initialData';
import { Header, ActiveTab } from './components/Header';
import { SalesInvoiceForm } from './components/SalesInvoiceForm';
import { OrderList } from './components/OrderList';
import { AnalyticsView } from './components/AnalyticsView';
import { ProductCatalogView } from './components/ProductCatalogView';
import { CustomerManagementView } from './components/CustomerManagementView';
import { InventoryManagementView } from './components/InventoryManagementView';
import { PrintInvoiceModal } from './components/PrintInvoiceModal';
import { SettingsModal } from './components/SettingsModal';
import { DataManagementModal } from './components/DataManagementModal';
import { LoginView } from './components/LoginView';
import { RevenueTrackingS1aView } from './components/RevenueTrackingS1aView';
import { isPartnerMode, transformOrderForPartner, applyPartnerDiscount, getDisplayPrice } from './utils/partnerConfig';

const STORAGE_TAB_KEY = 'xuongin194_active_tab';

const getInitialTab = (): ActiveTab => {
  if (isPartnerMode()) {
    return 'pos';
  }
  try {
    const validTabs: ActiveTab[] = ['pos', 's1a', 'orders', 'inventory', 'analytics', 'products', 'customers'];
    
    // 1. Check sessionStorage first (current active session)
    const fromSession = sessionStorage.getItem(STORAGE_TAB_KEY);
    if (fromSession && validTabs.includes(fromSession as ActiveTab)) {
      return fromSession as ActiveTab;
    }

    // 2. Check localStorage (persistent across browser restarts)
    const fromLocal = localStorage.getItem(STORAGE_TAB_KEY);
    if (fromLocal && validTabs.includes(fromLocal as ActiveTab)) {
      return fromLocal as ActiveTab;
    }
  } catch (e) {
    console.error('Error reading active tab from storage', e);
  }
  return 'pos';
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab);

  // Real-time Cloud Firestore state (100% cloud-native, no LocalStorage)
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stockImports, setStockImports] = useState<StockImportReceipt[]>([]);
  const [inkImports, setInkImports] = useState<InkImportRecord[]>([]);
  const [combos, setCombos] = useState<StudioCombo[]>([]);
  const [workshop, setWorkshop] = useState<WorkshopInfo>(DEFAULT_WORKSHOP_INFO);
  const [firestoreStatus, setFirestoreStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');

  // Print modal state
  const [activePrintOrder, setActivePrintOrder] = useState<Order | null>(null);

  // Editing order state for supplementing/updating an existing invoice
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Settings & Data Management modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);

  // Trigger to reset POS form to a brand new clean order
  const [newOrderTrigger, setNewOrderTrigger] = useState<number>(0);

  // User context object to tag record creators/editors
  const userContext = useMemo<AuthUserContext | null>(() => {
    if (!currentUser) return null;
    return {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName
    };
  }, [currentUser]);

  // 0. Listen to Firebase Authentication State
  useEffect(() => {
    const unsubscribeAuth = subscribeAuthState((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Function to switch tab and persist UI tab preference
  const handleSelectTab = (tab: ActiveTab) => {
    if (isPartnerMode() && (tab === 'orders' || tab === 'customers')) {
      setActiveTab('pos');
      return;
    }
    setActiveTab(tab);
    try {
      localStorage.setItem(STORAGE_TAB_KEY, tab);
      sessionStorage.setItem(STORAGE_TAB_KEY, tab);
    } catch (e) {
      console.error('Error saving active tab to storage', e);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TAB_KEY, activeTab);
      sessionStorage.setItem(STORAGE_TAB_KEY, activeTab);
    } catch (e) {
      console.error('Error saving active tab to storage', e);
    }
  }, [activeTab]);

  const handleTriggerNewOrder = () => {
    handleSelectTab('pos');
    setNewOrderTrigger(Date.now());
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setProducts([]);
      setCustomers([]);
      setOrders([]);
      setMaterials([]);
      setStockImports([]);
      setCombos([]);
    } catch (e) {
      console.error('Error during logout:', e);
    }
  };

  // 1. Real-time Firebase Cloud Firestore Synchronizer (onSnapshot 100%)
  useEffect(() => {
    if (!currentUser) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setFirestoreStatus('syncing');

    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount++;
      // Once critical collections have responded, hide initial loading screen
      if (loadedCount >= 3) {
        setDataLoading(false);
        setFirestoreStatus('connected');
      }
    };

    // Safety timer so network latency never locks the UI permanently
    const safetyTimer = setTimeout(() => {
      setDataLoading(false);
      setFirestoreStatus('connected');
    }, 2000);

    const unsubWorkshop = subscribeWorkshopInfo((data) => {
      setWorkshop(data);
      markLoaded();
    });

    const unsubProducts = subscribeProducts((data) => {
      setProducts(data);
      markLoaded();
    });

    const unsubCustomers = subscribeCustomers((data) => {
      setCustomers(data);
      markLoaded();
    });

    const unsubOrders = subscribeOrders((data) => {
      setOrders(data);
      markLoaded();
    });

    const unsubMaterials = subscribeMaterials((data) => {
      setMaterials(data);
      markLoaded();
    });

    const unsubStockImports = subscribeStockImports((data) => {
      setStockImports(data);
      markLoaded();
    });

    const unsubCombos = subscribeCombos((data) => {
      setCombos(data);
      markLoaded();
    });

    const unsubInk = subscribeInkImports((data) => {
      setInkImports(data);
      markLoaded();
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubWorkshop();
      unsubProducts();
      unsubCustomers();
      unsubOrders();
      unsubMaterials();
      unsubStockImports();
      unsubCombos();
      unsubInk();
    };
  }, [currentUser]);

  // Combo CRUD handlers (Direct Firestore)
  const handleSaveCombo = (combo: StudioCombo) => {
    saveComboToFirestore(combo, userContext).catch(console.error);
  };

  const handleDeleteCombo = (comboId: string) => {
    deleteComboFromFirestore(comboId).catch(console.error);
  };

  // Material CRUD handlers (Direct Firestore)
  const handleSaveMaterial = (material: Material) => {
    saveMaterialToFirestore(material, userContext).catch(console.error);
  };

  const handleDeleteMaterial = (materialId: string) => {
    deleteMaterialFromFirestore(materialId).catch(console.error);
  };

  // Stock Inward / Purchase handler: lưu TRỰC TIẾP lên collection 'purchases' trên Firestore
  const handleSaveStockImport = (receipt: StockImportReceipt) => {
    saveStockImportToFirestore(receipt, userContext).catch(console.error);

    // Tự động tăng số lượng tồn kho vật tư nếu phiếu có gắn mã vật tư tương ứng
    materials.forEach(mat => {
      const importedItem = receipt.items.find(it => it.materialId === mat.id);
      if (importedItem) {
        const updatedMat: Material = {
          ...mat,
          stockQuantity: mat.stockQuantity + importedItem.quantity,
          updatedAt: new Date().toISOString()
        };
        saveMaterialToFirestore(updatedMat, userContext).catch(console.error);
      }
    });
  };

  const handleDeleteStockImport = (receiptId: string) => {
    deleteStockImportFromFirestore(receiptId).catch(console.error);
  };

  // Ink Import CRUD handlers (Direct Firestore)
  const handleSaveInkImport = (record: InkImportRecord) => {
    saveInkImportToFirestore(record, userContext).catch(console.error);
  };

  const handleDeleteInkImport = (recordId: string) => {
    deleteInkImportFromFirestore(recordId).catch(console.error);
  };

  const handleResetInkYear = (year: number) => {
    resetInkYearInFirestore(year).catch(console.error);
  };

  // Stock adjustment / use (Lưu trực tiếp Firestore)
  const handleAdjustStock = (materialId: string, newQuantity: number) => {
    const target = materials.find(m => m.id === materialId);
    if (!target) return;
    const updatedMat: Material = {
      ...target,
      stockQuantity: newQuantity,
      updatedAt: new Date().toISOString()
    };
    saveMaterialToFirestore(updatedMat, userContext).catch(console.error);
  };

  // Inventory clearing & resetting handlers (Direct Firestore)
  const handleClearAllInventory = () => {
    materials.forEach(m => {
      deleteMaterialFromFirestore(m.id).catch(console.error);
    });
    clearAllPurchasesFromFirestore().catch(console.error);
  };

  const handleResetStockToZero = () => {
    materials.forEach(mat => {
      saveMaterialToFirestore({
        ...mat,
        stockQuantity: 0,
        updatedAt: new Date().toISOString()
      }, userContext).catch(console.error);
    });
  };

  const handleReloadDefaultMaterials = () => {
    DEFAULT_MATERIALS.forEach(mat => {
      saveMaterialToFirestore(mat, userContext).catch(console.error);
    });
  };

  const handleClearAllStockImports = () => {
    clearAllPurchasesFromFirestore().catch(console.error);
  };

  const lowStockCount = useMemo(() => {
    return materials.filter(m => m.stockQuantity > 0 && m.stockQuantity <= m.minStockAlert).length;
  }, [materials]);

  // Save or Update order handler (Firestore Transaction an toàn)
  const handleSaveOrder = (newOrder: Order, openPrint: boolean) => {
    // Tìm hóa đơn cũ trước khi sửa (nếu có)
    const previousOrder = orders.find(o => o.id === newOrder.id) || editingOrder || null;

    // Sử dụng Firestore Transaction an toàn: Hoàn trả kho cũ và trừ kho mới chính xác tuyệt đối
    saveOrUpdateOrderWithInventoryTransaction(newOrder, previousOrder, userContext, materials)
      .catch(console.error);

    // If customer doesn't exist, create customer directly on Cloud
    const existingCust = customers.find(c => c.id === newOrder.customerId);
    if (!existingCust && newOrder.customerName) {
      const newCust: Customer = {
        id: newOrder.customerId,
        name: newOrder.customerName,
        phone: newOrder.customerPhone,
        address: newOrder.customerAddress,
        initialDebt: 0,
        createdAt: new Date().toISOString()
      };
      saveCustomerToFirestore(newCust, userContext).catch(console.error);
    }

    setEditingOrder(null);

    if (openPrint) {
      setActivePrintOrder(newOrder);
    }
  };

  // Customer handlers (Direct Firestore)
  const handleAddCustomer = (customer: Customer) => {
    saveCustomerToFirestore(customer, userContext).catch(console.error);
  };

  const handleUpdateCustomer = (customer: Customer) => {
    saveCustomerToFirestore(customer, userContext).catch(console.error);
  };

  const handleDeleteCustomer = (customerId: string) => {
    deleteCustomerFromFirestore(customerId).catch(console.error);
  };

  // Record debt payment from customer (Direct Firestore)
  const handleRecordDebtPayment = (customerId: string, amount: number, note: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const curDebt = calculateCustomerDebt(customerId, orders, customers);
    const paymentOrder: Order = {
      id: `pay-${Date.now()}`,
      orderNumber: `PT-194-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().slice(0, 10),
      customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      items: [
        {
          id: `item-pay-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          productCode: 'THU-NO',
          productName: 'Phiếu Thu Tiền Nợ In Ảnh',
          size: '-',
          price: 0,
          quantity: 1,
          amount: 0,
          note
        }
      ],
      subtotal: 0,
      discount: 0,
      previousDebt: curDebt,
      paid: amount,
      totalDue: Math.max(0, curDebt - amount),
      status: 'completed',
      notes: note || 'Khách thanh toán nợ cũ',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveOrderToFirestore(paymentOrder, userContext).catch(console.error);
  };

  // Product handlers (Direct Firestore)
  const handleAddProduct = (product: Product) => {
    saveProductToFirestore(product, userContext).catch(console.error);
  };

  const handleUpdateProduct = (product: Product) => {
    saveProductToFirestore(product, userContext).catch(console.error);
  };

  const handleDeleteProduct = (productId: string) => {
    deleteProductFromFirestore(productId).catch(console.error);
  };

  const handleBatchSaveProducts = (newProducts: Product[]) => {
    newProducts.forEach(p => {
      saveProductToFirestore(p, userContext).catch(console.error);
    });
  };

  // Delete order (and automatically restore any deducted inventory materials back to stock on Firestore)
  const handleDeleteOrder = (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (orderToDelete && orderToDelete.materialsDeducted && orderToDelete.materialsDeducted.length > 0) {
      materials.forEach(mat => {
        const totalDeduction = orderToDelete.materialsDeducted
          ?.filter(d => d.materialId === mat.id)
          .reduce((sum, d) => sum + d.quantity, 0) || 0;
        if (totalDeduction > 0) {
          const restoredMat: Material = {
            ...mat,
            stockQuantity: Math.round((mat.stockQuantity + totalDeduction) * 100) / 100,
            updatedAt: new Date().toISOString()
          };
          saveMaterialToFirestore(restoredMat, userContext).catch(console.error);
        }
      });
    }

    deleteOrderFromFirestore(orderId).catch(console.error);
  };

  // Reset all sales orders and customer baseline data for a specific year directly on Firestore
  const handleResetYearData = (year: number, resetType: 'all' | 'ordersOnly' | 'baselineOnly' = 'all') => {
    if (resetType === 'all' || resetType === 'ordersOnly') {
      const ordersInYear = orders.filter(o => new Date(o.date).getFullYear() === year);
      ordersInYear.forEach(o => {
        deleteOrderFromFirestore(o.id).catch(console.error);
      });
    }

    if (resetType === 'all' || resetType === 'baselineOnly') {
      customers.forEach(c => {
        if (c.initialYearlyRevenues && c.initialYearlyRevenues[year]) {
          const newYearly = { ...c.initialYearlyRevenues };
          delete newYearly[year];
          const updatedCust: Customer = {
            ...c,
            initialYearlyRevenues: newYearly,
            initialYearlyRevenue: year === new Date().getFullYear() ? 0 : c.initialYearlyRevenue
          };
          saveCustomerToFirestore(updatedCust, userContext).catch(console.error);
        }
      });
    }
  };

  // Update order status directly on Firestore
  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;
    const updatedOrder: Order = { ...targetOrder, status, updatedAt: new Date().toISOString() };
    saveOrderToFirestore(updatedOrder, userContext).catch(console.error);
  };

  // Quick pay remaining debt on order directly on Firestore
  const handlePayOrderDebt = (order: Order) => {
    const paymentAmt = order.totalDue;
    if (paymentAmt <= 0) return;
    const updatedOrder: Order = {
      ...order,
      paid: order.paid + paymentAmt,
      totalDue: 0,
      status: 'completed' as OrderStatus,
      updatedAt: new Date().toISOString()
    };
    saveOrderToFirestore(updatedOrder, userContext).catch(console.error);
  };

  // Update workshop info directly on Firestore
  const handleUpdateWorkshop = (info: WorkshopInfo) => {
    saveWorkshopInfoToFirestore(info, userContext).catch(console.error);
  };

  // 1. Loading splash screen while verifying persistent session
  // Dữ liệu áp dụng chiết khấu đối tác khi ở chế độ Partner View (nhân 0.8 / giảm 20% doanh thu)
  const partnerOrders = useMemo(() => {
    if (!isPartnerMode()) return orders;
    return orders.map(transformOrderForPartner);
  }, [orders]);

  const partnerProducts = useMemo(() => {
    if (!isPartnerMode()) return products;
    return products.map(p => ({
      ...p,
      price: getDisplayPrice(p.price)
    }));
  }, [products]);

  const partnerCombos = useMemo(() => {
    if (!isPartnerMode()) return combos;
    return combos.map(c => ({
      ...c,
      items: Array.isArray(c.items)
        ? c.items.map(ci => ({
            ...ci,
            defaultPrice: ci.defaultPrice !== undefined ? getDisplayPrice(ci.defaultPrice) : undefined
          }))
        : c.items
    }));
  }, [combos]);

  const partnerCustomers = useMemo(() => {
    if (!isPartnerMode()) return customers;
    return customers.map(c => ({
      ...c,
      initialDebt: 0,
      initialYearlyRevenue: getDisplayPrice(c.initialYearlyRevenue || 0),
      initialYearlyRevenues: c.initialYearlyRevenues
        ? Object.fromEntries(
            Object.entries(c.initialYearlyRevenues).map(([k, v]) => [k, getDisplayPrice(v)])
          )
        : undefined
    }));
  }, [customers]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-slate-950 font-black text-2xl flex items-center justify-center shadow-xl shadow-amber-500/20 ring-4 ring-slate-800 animate-bounce mb-5">
          194
        </div>
        <div className="flex items-center gap-3 text-slate-300 font-semibold text-sm bg-slate-900/90 border border-slate-800 px-5 py-2.5 rounded-2xl shadow-xl">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
        <p className="text-xs text-slate-500 mt-3">Tiệm In 194 • Hệ thống Quản lý Bán hàng</p>
      </div>
    );
  }

  // 2. Lock UI completely if user is not signed in
  if (!currentUser) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  // 3. Loading Spinner while connecting & subscribing to Cloud Firestore
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-slate-950 font-black text-2xl flex items-center justify-center shadow-xl shadow-amber-500/20 ring-4 ring-slate-800 animate-pulse mb-5">
          194
        </div>
        <div className="flex items-center gap-3 text-slate-200 font-semibold text-sm bg-slate-900/90 border border-slate-800 px-5 py-3 rounded-2xl shadow-xl">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Đang kết nối Cloud Firestore và đồng bộ dữ liệu thời gian thực...</span>
        </div>
        <p className="text-xs text-slate-500 mt-3">Tiệm In 194 • Toàn bộ dữ liệu được bảo vệ an toàn trên Cloud</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Navigation & Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        workshop={workshop}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDataManagement={() => setIsDataManagementOpen(true)}
        ordersCount={orders.length}
        lowStockCount={lowStockCount}
        firestoreStatus={firestoreStatus}
        currentUserEmail={currentUser.email}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full mx-auto p-3 sm:p-4 md:p-5 lg:p-6">
        {/* Quick mobile tab sub-navigation for small screens */}
        <div className="flex sm:hidden overflow-x-auto gap-1 mb-4 pb-1">
          <button
            onClick={() => handleSelectTab('pos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
              activeTab === 'pos' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-white text-slate-700'
            }`}
          >
            Bán Hàng
          </button>
          {isPartnerMode() && (
            <button
              onClick={() => handleSelectTab('s1a')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                activeTab === 's1a' ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              Mẫu S1a
            </button>
          )}
          {!isPartnerMode() && (
            <button
              onClick={() => handleSelectTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                activeTab === 'orders' ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-700'
              }`}
            >
              Đơn ({orders.length})
            </button>
          )}
          <button
            onClick={() => handleSelectTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 ${
              activeTab === 'inventory' ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-700'
            }`}
          >
            <span>Kho</span>
            {lowStockCount > 0 && (
              <span className="px-1 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono">
                {lowStockCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleSelectTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
              activeTab === 'analytics' ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-700'
            }`}
          >
            Thống Kê
          </button>
          <button
            onClick={() => handleSelectTab('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
              activeTab === 'products' ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-700'
            }`}
          >
            Bảng Giá SP
          </button>
          {!isPartnerMode() && (
            <button
              onClick={() => handleSelectTab('customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                activeTab === 'customers' ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-700'
              }`}
            >
              Khách & Nợ
            </button>
          )}
          {!isPartnerMode() && (
            <button
              onClick={() => setIsDataManagementOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 shrink-0"
            >
              Cloud Data
            </button>
          )}
        </div>

        {/* Tab 1: Point of Sale / Main Order Creation */}
        {activeTab === 'pos' && (
          <SalesInvoiceForm
            products={partnerProducts}
            customers={isPartnerMode() ? [] : customers}
            allOrders={partnerOrders}
            materials={materials}
            combos={partnerCombos}
            onSaveCombo={isPartnerMode() ? () => {} : handleSaveCombo}
            onDeleteCombo={isPartnerMode() ? () => {} : handleDeleteCombo}
            onSaveOrder={handleSaveOrder}
            onAddNewCustomer={handleAddCustomer}
            onAddNewProduct={isPartnerMode() ? () => {} : handleAddProduct}
            newOrderTrigger={newOrderTrigger}
            editingOrder={editingOrder}
            onCancelEdit={() => setEditingOrder(null)}
          />
        )}

        {/* Tab Phụ: Theo dõi doanh thu mẫu S1a (Chỉ cho bản Đối Tác / Partner View) */}
        {activeTab === 's1a' && isPartnerMode() && (
          <RevenueTrackingS1aView
            orders={orders}
            workshop={workshop}
          />
        )}

        {/* Tab 2: Orders List (Ẩn hoàn toàn khỏi bản đối tác) */}
        {activeTab === 'orders' && !isPartnerMode() && (
          <OrderList
            orders={orders}
            onViewOrder={(order) => setActivePrintOrder(order)}
            onPrintOrder={(order) => setActivePrintOrder(order)}
            onEditOrder={(order) => {
              setEditingOrder(order);
              handleSelectTab('pos');
            }}
            onDeleteOrder={handleDeleteOrder}
            onUpdateStatus={handleUpdateOrderStatus}
            onPayDebt={handlePayOrderDebt}
          />
        )}

        {/* Tab 3: Inventory & Material Management (Kho Nhập Liệu) */}
        {activeTab === 'inventory' && (
          <InventoryManagementView
            materials={materials}
            stockImports={stockImports}
            inkImports={inkImports}
            orders={partnerOrders}
            products={partnerProducts}
            onSaveMaterial={handleSaveMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onSaveStockImport={handleSaveStockImport}
            onDeleteStockImport={handleDeleteStockImport}
            onSaveInkImport={handleSaveInkImport}
            onDeleteInkImport={handleDeleteInkImport}
            onResetInkYear={handleResetInkYear}
            onAdjustStock={handleAdjustStock}
            onClearAllInventory={handleClearAllInventory}
            onClearAllStockImports={handleClearAllStockImports}
            onResetStockToZero={handleResetStockToZero}
            onReloadDefaultMaterials={handleReloadDefaultMaterials}
          />
        )}

        {/* Tab 4: Monthly & Yearly Analytics with Profit & Loss (Doanh thu đã giảm 20% tự động nếu ở bản đối tác) */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            orders={partnerOrders}
            products={partnerProducts}
            stockImports={stockImports}
            customers={partnerCustomers}
            currentUserEmail={currentUser?.email}
            onResetYearData={isPartnerMode() ? undefined : handleResetYearData}
          />
        )}

        {/* Tab 5: Product Catalog & Auto-Fill Price List */}
        {activeTab === 'products' && (
          <ProductCatalogView
            products={partnerProducts}
            materials={materials}
            onAddProduct={isPartnerMode() ? () => {} : handleAddProduct}
            onUpdateProduct={isPartnerMode() ? () => {} : handleUpdateProduct}
            onDeleteProduct={isPartnerMode() ? () => {} : handleDeleteProduct}
            onBatchSaveProducts={isPartnerMode() ? () => {} : handleBatchSaveProducts}
          />
        )}

        {/* Tab 6: Customers & Debt Management (Ẩn hoàn toàn khỏi bản đối tác) */}
        {activeTab === 'customers' && !isPartnerMode() && (
          <CustomerManagementView
            customers={customers}
            orders={orders}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onRecordDebtPayment={handleRecordDebtPayment}
            onViewCustomerOrders={(cId) => {
              handleSelectTab('orders');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 sm:px-6 text-center text-xs text-slate-500 no-print mt-auto">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-semibold text-slate-700">
            © 2026 {workshop.name} • {workshop.subtitle}
          </p>
          <p className="text-[11px] text-slate-400">
            Hotline: <strong className="text-slate-800">{workshop.phone}</strong> • Đ/C: {workshop.address}
          </p>
        </div>
      </footer>

      {/* Printable Invoice Modal */}
      {activePrintOrder && (
        <PrintInvoiceModal
          order={isPartnerMode() ? transformOrderForPartner(activePrintOrder) : activePrintOrder}
          workshop={workshop}
          onClose={() => setActivePrintOrder(null)}
        />
      )}

      {/* Workshop Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          workshop={workshop}
          onUpdateWorkshop={handleUpdateWorkshop}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Data Management Modal */}
      {isDataManagementOpen && (
        <DataManagementModal
          orders={orders}
          customers={customers}
          products={products}
          materials={materials}
          stockImports={stockImports}
          combos={combos}
          workshop={workshop}
          userContext={userContext}
          onClose={() => setIsDataManagementOpen(false)}
        />
      )}
    </div>
  );
}
