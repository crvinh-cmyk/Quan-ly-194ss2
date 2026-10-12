import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product, Customer, Order, Material, StockImportReceipt, WorkshopInfo, StudioCombo, ProductCostItem, ProductCostMap, InkImportRecord, InkColorCode } from '../types';
import { DEFAULT_WORKSHOP_INFO, DEFAULT_INK_IMPORTS } from '../data/initialData';

// User info interface for tagging created/updated records
export interface AuthUserContext {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
}

/**
 * Chuyển đổi an toàn các định dạng Ngày/Giờ từ Firestore Timestamp (hoặc string, Date, seconds)
 * sang chuỗi ISO String chuẩn để ứng dụng không bao giờ bị crash
 */
export function normalizeFirestoreDate(val: any, fallback?: string): string {
  if (!val) return fallback || new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  // Firestore Timestamp instance có method toDate()
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch (_) {}
  }
  // Đối tượng Firestore Timestamp dạng { seconds: number, nanoseconds: number }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000).toISOString();
  }
  return fallback || new Date().toISOString();
}

/**
 * Chuyển đổi an toàn trường ngày ngắn YYYY-MM-DD
 */
export function normalizeDateOnly(val: any, fallback?: string): string {
  const iso = normalizeFirestoreDate(val, fallback);
  return iso.slice(0, 10);
}

/**
 * Loại bỏ các trường undefined trước khi ghi lên Firestore (tránh lỗi Unsupported field value: undefined)
 */
export function cleanFirestoreObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'object' && item !== null ? cleanFirestoreObject(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = cleanFirestoreObject(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Gán thông tin userId / người tạo vào bản ghi
 */
function attachUserInfo<T extends Record<string, any>>(data: T, userContext?: AuthUserContext | null): T {
  if (!userContext) return data;
  return {
    ...data,
    userId: data.userId || userContext.uid,
    createdBy: data.createdBy || userContext.email || userContext.displayName || undefined
  };
}

// Tên các Collection trên Firestore
export const COLLECTIONS = {
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  MATERIALS: 'materials',
  PURCHASES: 'purchases',
  SETTINGS: 'settings',
  COMBOS: 'combos',
  INK_IMPORTS: 'ink_imports'
} as const;

// =================================================================
// 1. WORKSHOP INFO (Cài đặt thông tin xưởng in 194)
// =================================================================
export function subscribeWorkshopInfo(
  onData: (info: WorkshopInfo) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'workshop_info');
  return onSnapshot(docRef, { includeMetadataChanges: false }, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const data: WorkshopInfo = {
        name: raw.name || DEFAULT_WORKSHOP_INFO.name,
        subtitle: raw.subtitle || DEFAULT_WORKSHOP_INFO.subtitle,
        phone: raw.phone || DEFAULT_WORKSHOP_INFO.phone,
        hotline: raw.hotline || DEFAULT_WORKSHOP_INFO.hotline,
        address: raw.address || DEFAULT_WORKSHOP_INFO.address,
        zalo: raw.zalo || DEFAULT_WORKSHOP_INFO.zalo,
        bankAccount: raw.bankAccount || DEFAULT_WORKSHOP_INFO.bankAccount,
        userId: raw.userId,
        updatedAt: normalizeFirestoreDate(raw.updatedAt)
      };
      onData(data);
    } else {
      // Dữ liệu mặc định hiển thị tạm thời khi chưa cấu hình trên Cloud
      onData(DEFAULT_WORKSHOP_INFO);
    }
  }, (error) => {
    console.error('Firestore workshop_info onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export async function saveWorkshopInfoToFirestore(
  info: WorkshopInfo,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'workshop_info');
  const enriched = attachUserInfo({
    ...info,
    updatedAt: new Date().toISOString()
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

// =================================================================
// 2. PRODUCTS (Danh mục Bảng giá & Sản phẩm in)
// =================================================================
export function subscribeProducts(
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, COLLECTIONS.PRODUCTS);
  return onSnapshot(colRef, { includeMetadataChanges: false }, (snapshot) => {
    const list: Product[] = [];
    snapshot.forEach(docSnap => {
      const raw = docSnap.data();
      const product: Product = {
        id: docSnap.id,
        code: raw.code || '',
        name: raw.name || '',
        size: raw.size || '',
        price: Number(raw.price) || 0,
        costPrice: raw.costPrice !== undefined ? Number(raw.costPrice) : undefined,
        category: raw.category || 'GIÁ STUDIO',
        unit: raw.unit || 'cái',
        description: raw.description,
        recipe: raw.recipe,
        materialCoreCode: raw.materialCoreCode,
        materialCoreName: raw.materialCoreName,
        materialCoreId: raw.materialCoreId,
        userId: raw.userId,
        createdBy: raw.createdBy,
        createdAt: normalizeFirestoreDate(raw.createdAt),
        updatedAt: normalizeFirestoreDate(raw.updatedAt)
      };
      list.push(product);
    });

    onData(list);
  }, (error) => {
    console.error('Firestore products onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export async function saveProductToFirestore(
  product: Product,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
  const enriched = attachUserInfo({
    ...product,
    createdAt: normalizeFirestoreDate(product.createdAt),
    updatedAt: new Date().toISOString()
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PRODUCTS, productId);
  await deleteDoc(docRef);
}

// =================================================================
// 3. CUSTOMERS (Khách hàng & Studio chụp ảnh)
// =================================================================
export function subscribeCustomers(
  onData: (customers: Customer[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, COLLECTIONS.CUSTOMERS);
  return onSnapshot(colRef, { includeMetadataChanges: false }, (snapshot) => {
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      const raw = docSnap.data();
      const customer: Customer = {
        id: docSnap.id,
        name: raw.name || '',
        phone: raw.phone || '',
        studioName: raw.studioName,
        address: raw.address,
        initialDebt: Number(raw.initialDebt) || 0,
        customerType: raw.customerType || 'GIÁ STUDIO',
        notes: raw.notes,
        yearlyRevenue: Number(raw.yearlyRevenue) || 0,
        initialYearlyRevenue: raw.initialYearlyRevenue ? Number(raw.initialYearlyRevenue) : undefined,
        initialYearlyRevenues: raw.initialYearlyRevenues,
        createdAt: normalizeFirestoreDate(raw.createdAt),
        userId: raw.userId,
        createdBy: raw.createdBy
      };
      list.push(customer);
    });

    onData(list);
  }, (error) => {
    console.error('Firestore customers onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export async function saveCustomerToFirestore(
  customer: Customer,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CUSTOMERS, customer.id);
  const enriched = attachUserInfo({
    ...customer,
    createdAt: normalizeFirestoreDate(customer.createdAt)
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

export async function deleteCustomerFromFirestore(customerId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
  await deleteDoc(docRef);
}

// =================================================================
// 4. ORDERS (Đơn hàng & Hóa đơn bán hàng)
// =================================================================
export function subscribeOrders(
  onData: (orders: Order[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, COLLECTIONS.ORDERS);
  return onSnapshot(colRef, { includeMetadataChanges: false }, (snapshot) => {
    const list: Order[] = [];
    snapshot.forEach(docSnap => {
      const raw = docSnap.data();
      const order: Order = {
        id: docSnap.id,
        orderNumber: raw.orderNumber || '',
        date: normalizeDateOnly(raw.date),
        customerId: raw.customerId || '',
        customerName: raw.customerName || '',
        customerPhone: raw.customerPhone || '',
        customerAddress: raw.customerAddress,
        items: Array.isArray(raw.items) ? raw.items.map((it: any) => ({
          ...it,
          date: normalizeDateOnly(it.date)
        })) : [],
        subtotal: Number(raw.subtotal) || 0,
        discount: Number(raw.discount) || 0,
        previousDebt: Number(raw.previousDebt) || 0,
        paid: Number(raw.paid) || 0,
        totalDue: Number(raw.totalDue) || 0,
        status: raw.status || 'pending',
        materialsDeducted: raw.materialsDeducted,
        notes: raw.notes,
        createdAt: normalizeFirestoreDate(raw.createdAt),
        updatedAt: normalizeFirestoreDate(raw.updatedAt),
        userId: raw.userId,
        createdBy: raw.createdBy
      };
      list.push(order);
    });

    // Sắp xếp đơn mới nhất lên đầu (theo createdAt hoặc date)
    list.sort((a, b) => {
      const timeB = new Date(b.createdAt || b.date).getTime();
      const timeA = new Date(a.createdAt || a.date).getTime();
      return timeB - timeA;
    });

    onData(list);
  }, (error) => {
    console.error('Firestore orders onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export async function saveOrderToFirestore(
  order: Order,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ORDERS, order.id);
  const enriched = attachUserInfo({
    ...order,
    date: normalizeDateOnly(order.date),
    createdAt: normalizeFirestoreDate(order.createdAt),
    updatedAt: new Date().toISOString()
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

/**
 * Lưu hoặc Cập nhật đơn hàng an toàn với Firestore Transaction / Batch:
 * Khi cập nhật/bổ sung đơn hàng:
 * 1. Hoàn trả (restore) toàn bộ số lượng vật tư / cốt ván đã trừ của hóa đơn cũ vào kho.
 * 2. Trừ toàn bộ số lượng vật tư / cốt ván mới theo danh sách hàng hóa bổ sung của hóa đơn mới.
 * 3. Đảm bảo tính nhất quán dữ liệu tồn kho, tránh trừ trùng lặp hoặc mất mát số lượng.
 */
export async function saveOrUpdateOrderWithInventoryTransaction(
  order: Order,
  previousOrder?: Order | null,
  user?: AuthUserContext | null,
  currentMaterials?: Material[]
): Promise<void> {
  const prevDeductions: Record<string, number> = {};
  if (previousOrder?.materialsDeducted && Array.isArray(previousOrder.materialsDeducted)) {
    for (const d of previousOrder.materialsDeducted) {
      if (d.materialId) {
        prevDeductions[d.materialId] = (prevDeductions[d.materialId] || 0) + (Number(d.quantity) || 0);
      }
    }
  }

  const newDeductions: Record<string, number> = {};
  if (order.materialsDeducted && Array.isArray(order.materialsDeducted)) {
    for (const d of order.materialsDeducted) {
      if (d.materialId) {
        newDeductions[d.materialId] = (newDeductions[d.materialId] || 0) + (Number(d.quantity) || 0);
      }
    }
  }

  const affectedMaterialIds = Array.from(
    new Set([...Object.keys(prevDeductions), ...Object.keys(newDeductions)])
  );

  const orderDocRef = doc(db, COLLECTIONS.ORDERS, order.id);
  const enrichedOrder = attachUserInfo({
    ...order,
    date: normalizeDateOnly(order.date),
    createdAt: normalizeFirestoreDate(order.createdAt),
    updatedAt: new Date().toISOString()
  }, user);

  // Thử dùng runTransaction để đảm bảo tính Atomic ACID
  try {
    await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST (Bắt buộc theo nguyên tắc của Firestore runTransaction)
      const materialReads: { ref: any; currentStock: number; id: string }[] = [];
      for (const matId of affectedMaterialIds) {
        const matRef = doc(db, COLLECTIONS.MATERIALS, matId);
        const snap = await transaction.get(matRef);
        let curStock = 0;
        if (snap.exists()) {
          curStock = Number(snap.data()?.stockQuantity) || 0;
        } else if (currentMaterials) {
          const inState = currentMaterials.find(m => m.id === matId);
          if (inState) curStock = inState.stockQuantity;
        }
        materialReads.push({ ref: matRef, currentStock: curStock, id: matId });
      }

      // 2. ALL WRITES
      // Lưu thông tin hóa đơn (ghi đè document ID cũ khi cập nhật)
      transaction.set(orderDocRef, cleanFirestoreObject(enrichedOrder), { merge: true });

      // Cập nhật số lượng tồn kho từng vật tư bị ảnh hưởng
      for (const m of materialReads) {
        const restoredQty = prevDeductions[m.id] || 0;
        const deductQty = newDeductions[m.id] || 0;
        // Tồn kho mới = Tồn kho hiện tại + Trả lại từ đơn cũ - Trừ theo đơn mới
        const netStock = Math.round(Math.max(0, m.currentStock + restoredQty - deductQty) * 100) / 100;
        transaction.update(m.ref, {
          stockQuantity: netStock,
          updatedAt: new Date().toISOString()
        });
      }
    });
  } catch (txError) {
    console.warn('Firestore runTransaction fallback sang writeBatch:', txError);
    // Fallback qua writeBatch khi chạy offline hoặc gặp lỗi Transaction timeout
    const batch = writeBatch(db);
    batch.set(orderDocRef, cleanFirestoreObject(enrichedOrder), { merge: true });

    for (const matId of affectedMaterialIds) {
      const inState = currentMaterials?.find(m => m.id === matId);
      const curStock = inState ? inState.stockQuantity : 0;
      const restoredQty = prevDeductions[matId] || 0;
      const deductQty = newDeductions[matId] || 0;
      const netStock = Math.round(Math.max(0, curStock + restoredQty - deductQty) * 100) / 100;
      const matRef = doc(db, COLLECTIONS.MATERIALS, matId);
      batch.update(matRef, {
        stockQuantity: netStock,
        updatedAt: new Date().toISOString()
      });
    }
    await batch.commit();
  }
}

export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ORDERS, orderId);
  await deleteDoc(docRef);
}

// =================================================================
// 5. MATERIALS (Kho vật tư nhập liệu & Tồn kho)
// =================================================================
export function subscribeMaterials(
  onData: (materials: Material[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, COLLECTIONS.MATERIALS);
  return onSnapshot(colRef, { includeMetadataChanges: false }, (snapshot) => {
    const list: Material[] = [];
    snapshot.forEach(docSnap => {
      const raw = docSnap.data();
      const material: Material = {
        id: docSnap.id,
        code: raw.code || '',
        name: raw.name || '',
        category: raw.category || 'Gỗ MDF',
        unit: raw.unit || 'Tấm',
        costPrice: Number(raw.costPrice) || 0,
        stockQuantity: Number(raw.stockQuantity) || 0,
        minStockAlert: Number(raw.minStockAlert) || 5,
        supplier: raw.supplier,
        notes: raw.notes,
        createdAt: normalizeFirestoreDate(raw.createdAt),
        updatedAt: normalizeFirestoreDate(raw.updatedAt),
        userId: raw.userId,
        createdBy: raw.createdBy
      };
      list.push(material);
    });

    onData(list);
  }, (error) => {
    console.error('Firestore materials onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export async function saveMaterialToFirestore(
  material: Material,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.MATERIALS, material.id);
  const enriched = attachUserInfo({
    ...material,
    createdAt: normalizeFirestoreDate(material.createdAt),
    updatedAt: new Date().toISOString()
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

export async function deleteMaterialFromFirestore(materialId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.MATERIALS, materialId);
  await deleteDoc(docRef);
}

// =================================================================
// 6. PURCHASES (Hóa đơn nhập kho / Nhập vật tư theo nhà cung cấp)
// =================================================================
export function subscribePurchases(
  onData: (imports: StockImportReceipt[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, COLLECTIONS.PURCHASES);
  return onSnapshot(colRef, { includeMetadataChanges: false }, (snapshot) => {
    const list: StockImportReceipt[] = [];
    snapshot.forEach(docSnap => {
      const raw = docSnap.data();
      const receipt: StockImportReceipt = {
        id: docSnap.id,
        receiptNumber: raw.receiptNumber || '',
        date: normalizeDateOnly(raw.date),
        supplier: raw.supplier || '',
        items: Array.isArray(raw.items) ? raw.items : [],
        totalAmount: Number(raw.totalAmount) || 0,
        paid: Number(raw.paid) || 0,
        notes: raw.notes || '',
        createdAt: normalizeFirestoreDate(raw.createdAt),
        userId: raw.userId,
        createdBy: raw.createdBy
      };
      list.push(receipt);
    });

    // Sắp xếp ngày nhập mới nhất lên đầu
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onData(list);
  }, (error) => {
    console.error('Firestore purchases onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export const subscribeStockImports = subscribePurchases;

export async function savePurchaseToFirestore(
  receipt: StockImportReceipt,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PURCHASES, receipt.id);
  const enriched = attachUserInfo({
    ...receipt,
    date: normalizeDateOnly(receipt.date),
    createdAt: normalizeFirestoreDate(receipt.createdAt)
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

export const saveStockImportToFirestore = savePurchaseToFirestore;

export async function deletePurchaseFromFirestore(receiptId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PURCHASES, receiptId);
  await deleteDoc(docRef);
}

export const deleteStockImportFromFirestore = deletePurchaseFromFirestore;

export async function clearAllPurchasesFromFirestore(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTIONS.PURCHASES));
  const batch = writeBatch(db);
  snap.forEach(d => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

// =================================================================
// 7. COMBOS (Gói combo sản phẩm in)
// =================================================================
export function subscribeCombos(
  onData: (combos: StudioCombo[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, COLLECTIONS.COMBOS);
  return onSnapshot(colRef, { includeMetadataChanges: false }, (snapshot) => {
    const list: StudioCombo[] = [];
    snapshot.forEach(docSnap => {
      const raw = docSnap.data();
      const combo: StudioCombo = {
        id: docSnap.id,
        name: raw.name || '',
        studioName: raw.studioName,
        customerId: raw.customerId,
        description: raw.description,
        items: Array.isArray(raw.items) ? raw.items : [],
        createdAt: normalizeFirestoreDate(raw.createdAt),
        updatedAt: normalizeFirestoreDate(raw.updatedAt),
        userId: raw.userId,
        createdBy: raw.createdBy
      };
      list.push(combo);
    });

    onData(list);
  }, (error) => {
    console.error('Firestore combos onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export async function saveComboToFirestore(
  combo: StudioCombo,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.COMBOS, combo.id);
  const enriched = attachUserInfo({
    ...combo,
    createdAt: normalizeFirestoreDate(combo.createdAt),
    updatedAt: new Date().toISOString()
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

export async function deleteComboFromFirestore(comboId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.COMBOS, comboId);
  await deleteDoc(docRef);
}

// =================================================================
// 8. INVENTORY PRESETS / QUICK SUGGESTIONS (Gợi ý chọn nhanh NCC & Mặt hàng)
// =================================================================
export const DEFAULT_PRESET_SUPPLIERS = [
  'Trang Phóng',
  'SVP',
  'Xuân Trường HN',
  'Toản HN',
  'Ninh Trang',
  'Tuấn Tú Vinh',
  'Khác'
];

export const DEFAULT_PRESET_ITEMS = [
  'Ván MDF',
  'Fomex',
  'Khung Phào',
  'Mica',
  'Màng lụa',
  'Nẹp Viền',
  'Keo',
  'Chân sắt',
  'Móc treo',
  'Màng PE',
  'Băng keo',
  'Giấy',
  'Mực',
  'Ruột album',
  'Khác'
];

export interface InventoryPresets {
  suppliers: string[];
  items: string[];
  updatedAt?: string;
  userId?: string;
}

const STORAGE_KEY_PRESETS = 'quanly194_inventory_presets';

export function getLocalInventoryPresets(): InventoryPresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.suppliers) && Array.isArray(parsed.items) && parsed.suppliers.length > 0 && parsed.items.length > 0) {
        return {
          suppliers: parsed.suppliers,
          items: parsed.items,
          updatedAt: parsed.updatedAt
        };
      }
    }
  } catch (e) {
    // ignore
  }
  return {
    suppliers: [...DEFAULT_PRESET_SUPPLIERS],
    items: [...DEFAULT_PRESET_ITEMS]
  };
}

export function saveLocalInventoryPresets(presets: InventoryPresets): void {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  } catch (e) {
    // ignore
  }
}

export function subscribeInventoryPresets(
  onData: (presets: InventoryPresets) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'inventory_presets');
  return onSnapshot(docRef, { includeMetadataChanges: false }, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const rawSuppliers = Array.isArray(raw.suppliers) ? raw.suppliers : [];
      const rawItems = Array.isArray(raw.items) ? raw.items : [];
      
      const suppliers = rawSuppliers.length > 0
        ? rawSuppliers.map((s: any) => String(s).trim()).filter(Boolean)
        : [...DEFAULT_PRESET_SUPPLIERS];

      const items = rawItems.length > 0
        ? rawItems.map((it: any) => String(it).trim()).filter(Boolean)
        : [...DEFAULT_PRESET_ITEMS];

      const presets: InventoryPresets = {
        suppliers,
        items,
        updatedAt: raw.updatedAt,
        userId: raw.userId
      };
      saveLocalInventoryPresets(presets);
      onData(presets);
    } else {
      const initial = getLocalInventoryPresets();
      onData(initial);
    }
  }, (error) => {
    console.error('Firestore inventory_presets onSnapshot error:', error);
    if (onError) onError(error);
  });
}

export async function saveInventoryPresetsToFirestore(
  presets: { suppliers: string[]; items: string[] },
  user?: AuthUserContext | null
): Promise<void> {
  const cleanedSuppliers = presets.suppliers
    .map(s => s.trim())
    .filter(Boolean);
  const cleanedItems = presets.items
    .map(it => it.trim())
    .filter(Boolean);

  const payload: InventoryPresets = {
    suppliers: cleanedSuppliers.length > 0 ? cleanedSuppliers : [...DEFAULT_PRESET_SUPPLIERS],
    items: cleanedItems.length > 0 ? cleanedItems : [...DEFAULT_PRESET_ITEMS],
    updatedAt: new Date().toISOString()
  };

  saveLocalInventoryPresets(payload);

  const docRef = doc(db, COLLECTIONS.SETTINGS, 'inventory_presets');
  const enriched = attachUserInfo(payload, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

// =================================================================
// 9. PRODUCT COSTS BREAKDOWN (ĐỊNH MỨC GIÁ VỐN THEO MÃ SẢN PHẨM)
// =================================================================
const PRODUCT_COSTS_LOCAL_KEY = 'xuongin194_product_costs_v1';

export function getLocalProductCosts(): ProductCostMap {
  try {
    const raw = localStorage.getItem(PRODUCT_COSTS_LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function saveLocalProductCosts(costs: ProductCostMap): void {
  try {
    localStorage.setItem(PRODUCT_COSTS_LOCAL_KEY, JSON.stringify(costs));
  } catch (e) {
    console.error('Error saving local product costs:', e);
  }
}

/**
 * Lắng nghe thời gian thực (Real-time listener) bảng định mức giá vốn của từng mã sản phẩm
 */
export function subscribeProductCosts(
  onData: (costs: ProductCostMap) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'product_costs');
  return onSnapshot(docRef, { includeMetadataChanges: false }, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const costs: ProductCostMap = (raw.costs && typeof raw.costs === 'object') ? raw.costs : {};
      saveLocalProductCosts(costs);
      onData(costs);
    } else {
      const initial = getLocalProductCosts();
      onData(initial);
    }
  }, (error) => {
    console.error('Firestore product_costs onSnapshot error:', error);
    if (onError) onError(error);
  });
}

/**
 * Lưu bảng định mức chi phí giá vốn lên Firestore
 */
export async function saveProductCostsToFirestore(
  costs: ProductCostMap,
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalProductCosts(costs);
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'product_costs');
  const payload = {
    costs,
    updatedAt: new Date().toISOString()
  };
  const enriched = attachUserInfo(payload, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}

// =================================================================
// 9. INK IMPORTS (Theo dõi lượng mực nhập 12 màu Canon Lucia Pro)
// =================================================================
const INK_IMPORTS_STORAGE_KEY = 'tiem_in_194_ink_imports_cache';

export function getLocalInkImports(): InkImportRecord[] {
  try {
    const raw = localStorage.getItem(INK_IMPORTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading local ink imports:', e);
  }
  return DEFAULT_INK_IMPORTS;
}

export function saveLocalInkImports(imports: InkImportRecord[]) {
  try {
    localStorage.setItem(INK_IMPORTS_STORAGE_KEY, JSON.stringify(imports));
  } catch (e) {
    console.error('Error saving local ink imports:', e);
  }
}

export function subscribeInkImports(
  onData: (records: InkImportRecord[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, COLLECTIONS.INK_IMPORTS);
  return onSnapshot(colRef, { includeMetadataChanges: false }, (snapshot) => {
    const list: InkImportRecord[] = [];
    snapshot.forEach(docSnap => {
      const raw = docSnap.data();
      const recDate = normalizeDateOnly(raw.date);
      const recYear = typeof raw.year === 'number' ? raw.year : new Date(recDate).getFullYear();
      
      const record: InkImportRecord = {
        id: docSnap.id,
        receiptNumber: raw.receiptNumber || `NK-MUC-${recYear}-${docSnap.id.slice(-4)}`,
        date: recDate,
        year: recYear,
        supplier: raw.supplier || 'SVP',
        items: (raw.items && typeof raw.items === 'object') ? raw.items : {} as Record<InkColorCode, number>,
        totalQuantity: Number(raw.totalQuantity) || 0,
        unit: raw.unit || 'Bình',
        costPricePerBottle: raw.costPricePerBottle ? Number(raw.costPricePerBottle) : undefined,
        totalCost: raw.totalCost ? Number(raw.totalCost) : undefined,
        notes: raw.notes || '',
        createdAt: normalizeFirestoreDate(raw.createdAt),
        updatedAt: normalizeFirestoreDate(raw.updatedAt),
        userId: raw.userId,
        createdBy: raw.createdBy
      };
      list.push(record);
    });

    if (list.length === 0 && snapshot.empty) {
      // First run or empty: Seed initial defaults for instant usability
      const cached = getLocalInkImports();
      if (cached.length > 0) {
        onData(cached);
        // Async background seed to Firestore
        cached.forEach(rec => {
          saveInkImportToFirestore(rec).catch(() => {});
        });
        return;
      }
    }

    // Sort newest date first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    saveLocalInkImports(list);
    onData(list);
  }, (error) => {
    console.error('Firestore ink_imports onSnapshot error:', error);
    // Offline fallback
    const cached = getLocalInkImports();
    onData(cached);
    if (onError) onError(error);
  });
}

export async function saveInkImportToFirestore(
  record: InkImportRecord,
  user?: AuthUserContext | null
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.INK_IMPORTS, record.id);
  const recDate = normalizeDateOnly(record.date);
  const recYear = record.year || new Date(recDate).getFullYear();
  
  // Calculate total if not set
  let totalQty = record.totalQuantity;
  if (!totalQty && record.items) {
    totalQty = Object.values(record.items).reduce((s, v) => s + (Number(v) || 0), 0);
  }

  const enriched = attachUserInfo({
    ...record,
    date: recDate,
    year: recYear,
    supplier: record.supplier || 'SVP',
    totalQuantity: totalQty,
    createdAt: normalizeFirestoreDate(record.createdAt),
    updatedAt: new Date().toISOString()
  }, user);

  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });

  // Update local cache
  const current = getLocalInkImports();
  const existingIdx = current.findIndex(r => r.id === record.id);
  let updatedList: InkImportRecord[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = enriched as InkImportRecord;
  } else {
    updatedList = [enriched as InkImportRecord, ...current];
  }
  saveLocalInkImports(updatedList);
}

export async function deleteInkImportFromFirestore(recordId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.INK_IMPORTS, recordId);
  await deleteDoc(docRef);
  const current = getLocalInkImports();
  saveLocalInkImports(current.filter(r => r.id !== recordId));
}

export async function resetInkYearInFirestore(targetYear: number): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTIONS.INK_IMPORTS));
  const batch = writeBatch(db);
  let matchCount = 0;
  snap.forEach(d => {
    const raw = d.data();
    const dYear = typeof raw.year === 'number' ? raw.year : new Date(raw.date || '').getFullYear();
    if (dYear === targetYear) {
      batch.delete(d.ref);
      matchCount++;
    }
  });
  if (matchCount > 0) {
    await batch.commit();
  }
  const current = getLocalInkImports();
  saveLocalInkImports(current.filter(r => r.year !== targetYear));
}

export async function clearAllInkImportsFromFirestore(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTIONS.INK_IMPORTS));
  const batch = writeBatch(db);
  snap.forEach(d => batch.delete(d.ref));
  await batch.commit();
  saveLocalInkImports([]);
}

// =================================================================
// 9. REVENUE DEDUCTIONS (Khấu trừ doanh thu từng tháng)
// =================================================================
const STORAGE_KEY_REVENUE_DEDUCTIONS = 'xuongin194_revenue_deductions_v1';

export function getLocalRevenueDeductions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REVENUE_DEDUCTIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalRevenueDeductions(data: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY_REVENUE_DEDUCTIONS, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving local revenue deductions:', e);
  }
}

export function subscribeRevenueDeductions(
  onData: (deductions: Record<string, number>) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'revenue_deductions');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const cleanData: Record<string, number> = {};
      Object.entries(raw).forEach(([k, v]) => {
        if (k !== 'updatedAt' && k !== 'userId' && k !== 'createdBy') {
          const num = Number(v);
          if (!isNaN(num)) cleanData[k] = num;
        }
      });
      saveLocalRevenueDeductions(cleanData);
      onData(cleanData);
    } else {
      const local = getLocalRevenueDeductions();
      onData(local);
    }
  }, (err) => {
    console.error('Firestore revenue_deductions onSnapshot error:', err);
    onData(getLocalRevenueDeductions());
    if (onError) onError(err);
  });
}

export async function saveRevenueDeductionsToFirestore(
  deductions: Record<string, number>,
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalRevenueDeductions(deductions);
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'revenue_deductions');
  const enriched = attachUserInfo({
    ...deductions,
    updatedAt: new Date().toISOString()
  }, user);
  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
}



