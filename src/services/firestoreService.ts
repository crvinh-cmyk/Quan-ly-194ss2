import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product, Customer, Order, Material, StockImportReceipt, StockImportItem, WorkshopInfo, StudioCombo, ProductCostItem, ProductCostMap, InkImportRecord, InkColorCode, S1aDayOverride, S1aManualEntry, BoardCorePriceRow, BoardCorePriceMap, AccessoryMaterialItem, AccessoryMaterialMap, PaperMaterialItem, PaperMaterialMap, ArchivedDeletedCustomerRevenue, MonthOtherExpenses, OtherExpensesMap } from '../types';
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
        isFavorite: Boolean(raw.isFavorite),
        isLocked: Boolean(raw.isLocked),
        favoriteSettlements: raw.favoriteSettlements || undefined,
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
    isFavorite: Boolean(customer.isFavorite),
    isLocked: Boolean(customer.isLocked),
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
      const recDate = normalizeDateOnly(raw.date);
      const recStatus = raw.status || (recDate <= '2026-10-03' ? 'completed' : 'pending');
      const receipt: StockImportReceipt = {
        id: docSnap.id,
        receiptNumber: raw.receiptNumber || '',
        date: recDate,
        supplier: raw.supplier || '',
        items: Array.isArray(raw.items) ? raw.items : [],
        totalAmount: Number(raw.totalAmount) || 0,
        paid: Number(raw.paid) || 0,
        status: recStatus,
        isSynced: Boolean(raw.isSynced),
        syncedAt: raw.syncedAt,
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



// =================================================================
// HELPERS FOR INVENTORY & INK DEDUCTION (RULE 1 & RULE 2)
// =================================================================
export function findMatchedMaterial(item: StockImportItem, materialsList: Material[] = []): Material | undefined {
  const id = item.materialId;
  const code = (item.materialCode || "").toUpperCase().trim();

  // 1. Primary match: Material ID
  if (id) {
    const byId = materialsList.find(m => m.id === id);
    if (byId) return byId;
  }
  // 2. Secondary match: SKU Code
  if (code) {
    const byCode = materialsList.find(m => m.code && m.code.toUpperCase().trim() === code);
    if (byCode) return byCode;
  }
  // 3. Fallback only if no ID or SKU Code is present
  if (!id && !code && item.materialName) {
    const name = item.materialName.toLowerCase().trim();
    const byExactName = materialsList.find(m => m.name && m.name.toLowerCase().trim() === name);
    if (byExactName) return byExactName;
  }
  return undefined;
}

export function isMDFOrFomexMaterial(mat?: Material, item?: StockImportItem): boolean {
  const code = ((mat?.code || "") + " " + (item?.materialCode || "")).toUpperCase();
  const cat = (mat?.category || "").toLowerCase();

  // Primary check: SKU Code
  if (code.includes("MDF") || code.includes("FOMEX") || code.includes("VT-GO") || code.includes("VT-FX")) {
    return true;
  }
  // Secondary check: Category
  if (cat.includes("mdf") || cat.includes("gỗ") || cat.includes("fomex")) {
    return true;
  }
  // Fallback check: Name
  const name = ((mat?.name || "") + " " + (item?.materialName || "")).toLowerCase();
  return name.includes("mdf") || name.includes("ván") || name.includes("fomex");
}

export function isInkMaterial(item: StockImportItem): boolean {
  const code = (item.materialCode || "").toUpperCase();
  if (code.includes("MUC") || code.includes("LUCIA") || code.startsWith("MUC-")) {
    return true;
  }
  const name = (item.materialName || "").toLowerCase();
  return name.includes("mực") || name.includes("lucia");
}

export function extractInkColorCode(codeStr: string, nameStr: string): InkColorCode {
  const codeText = (codeStr || "").toUpperCase().trim();
  const nameText = (nameStr || "").toUpperCase().trim();
  const colorOrder: InkColorCode[] = ["PGY", "PBK", "MBK", "GY", "PM", "PC", "CO", "C", "M", "Y", "R", "B"];

  // 1. Extract directly from SKU Code first (e.g. MUC-LUCIA-MBK -> MBK)
  for (const col of colorOrder) {
    if (codeText.includes("-" + col) || codeText.endsWith(col) || codeText.includes("_" + col)) {
      return col;
    }
  }

  // 2. Extract from display name
  const text = codeText + " " + nameText;
  for (const col of colorOrder) {
    if (text.includes("-" + col) || text.includes(" " + col + " ") || text.endsWith(" " + col) || text.endsWith("-" + col) || text.includes("MỰC " + col) || text.includes("BÌNH " + col)) {
      return col;
    }
  }
  for (const col of colorOrder) {
    if (text.includes(col)) {
      return col;
    }
  }
  return "MBK";
}

export async function executeStockImportAutoSync(
  receipt: StockImportReceipt,
  materialsList: Material[] = [],
  user?: AuthUserContext | null
): Promise<void> {
  if (receipt.status !== "completed") {
    return;
  }

  let currentMaterials = materialsList;
  if (!currentMaterials || currentMaterials.length === 0) {
    try {
      const mSnap = await getDocs(collection(db, COLLECTIONS.MATERIALS));
      currentMaterials = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Material));
    } catch (e) {
      console.error("Error fetching materials for executeStockImportAutoSync:", e);
    }
  }

  const shouldSyncStock = !receipt.isSynced;
  const nowFormatted = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const boardPrices = { ...getLocalBoardCorePrices() };
  let boardPricesChanged = false;
  const accItems = [...getLocalAccessoryMaterials()];
  let accItemsChanged = false;
  const paperItems = [...getLocalPaperMaterials()];
  let paperItemsChanged = false;

  let hasInkItems = false;
  const inkColorQuantities: Record<InkColorCode, number> = {
    PM: 0, R: 0, C: 0, PGY: 0, PBK: 0, MBK: 0,
    CO: 0, GY: 0, B: 0, Y: 0, M: 0, PC: 0
  };
  let totalInkCost = 0;
  let totalInkQty = 0;

  for (const item of (receipt.items || [])) {
    const code = (item.materialCode || "").toUpperCase().trim();
    const name = (item.materialName || "").toLowerCase().trim();
    const costPrice = Number(item.costPrice) || 0;
    const qty = Number(item.quantity) || 0;

    // 1. Cộng Tồn Kho (materials) - CHỈ CỘNG VÁN MDF & FOMEX ĐÃ TỒN TẠI
    if (shouldSyncStock && qty > 0) {
      const matchedMat = findMatchedMaterial(item, currentMaterials);
      if (matchedMat && isMDFOrFomexMaterial(matchedMat, item)) {
        const updatedMat: Material = {
          ...matchedMat,
          stockQuantity: (Number(matchedMat.stockQuantity) || 0) + qty,
          costPrice: costPrice > 0 ? costPrice : matchedMat.costPrice,
          updatedAt: new Date().toISOString()
        };
        await saveMaterialToFirestore(updatedMat, user).catch(console.error);
      }
    }

    // 2. Theo dõi mực in (12 màu Lucia Pro)
    if (isInkMaterial(item) && qty > 0) {
      hasInkItems = true;
      const colorCode = extractInkColorCode(item.materialCode || "", item.materialName || "");
      inkColorQuantities[colorCode] = (inkColorQuantities[colorCode] || 0) + qty;
      totalInkQty += qty;
      totalInkCost += (item.totalCost || (costPrice * qty));
    }

    // 3. Cập nhật Bảng Giá Cốt Vật Tư (BoardCorePrices)
    if (costPrice > 0 && boardPrices) {
      Object.keys(boardPrices).forEach(sizeKey => {
        const row = boardPrices[sizeKey];
        const codeClean = code.replace(/\s+/g, '');
        const fullItemStr = `${code} ${name}`.toUpperCase();

        const sizeKeyClean = sizeKey.toUpperCase().replace(/\s+/g, '');
        const sizeParts = sizeKeyClean.split(/X|\*/);

        let isSizeMatch = false;

        if (sizeParts.length === 2) {
          const w = sizeParts[0];
          const h = sizeParts[1];
          const concatCode = w + h;
          const xCode = `${w}X${h}`;
          const starCode = `${w}*${h}`;

          if (
            fullItemStr.includes(xCode) ||
            fullItemStr.includes(starCode) ||
            fullItemStr.includes(concatCode) ||
            fullItemStr.includes(`${w} ${h}`) ||
            (codeClean && (codeClean === sizeKeyClean || codeClean === (row.code || '').toUpperCase().replace(/\s+/g, '')))
          ) {
            isSizeMatch = true;
          }
        } else {
          if (
            codeClean &&
            (codeClean === sizeKeyClean ||
             codeClean === (row.code || '').toUpperCase().replace(/\s+/g, '') ||
             fullItemStr.includes(sizeKeyClean))
          ) {
            isSizeMatch = true;
          }
        }

        if (isSizeMatch) {
          boardPricesChanged = true;
          const updatedRow = { ...row, updatedAt: nowFormatted };
          if (fullItemStr.includes('12LI') || fullItemStr.includes('12MM') || fullItemStr.includes('LOIXANH') || fullItemStr.includes('LÕIXANH')) {
            updatedRow.mdf12li = costPrice;
          } else if (fullItemStr.includes('FOMEX') || fullItemStr.includes('SIÊUNHẸ') || fullItemStr.includes('SIEUNHE')) {
            updatedRow.fomex9li = costPrice;
          } else {
            updatedRow.mdf9li = costPrice;
          }
          boardPrices[sizeKey] = updatedRow;
        }
      });
    }

    // 4. Cập nhật Bảng Giá Phụ Kiện (AccessoryMaterials)
    if (costPrice > 0 && Array.isArray(accItems)) {
      accItems.forEach((acc, idx) => {
        const accName = (acc.name || "").toLowerCase().trim();
        const accId = (acc.id || "").toLowerCase().trim();
        const isAccMatch = (item.materialId && accId === item.materialId.toLowerCase()) ||
                           (name && accName && (accName.includes(name) || name.includes(accName))) ||
                           (code && acc.id.toUpperCase() === code);
        if (isAccMatch) {
          accItemsChanged = true;
          accItems[idx] = {
            ...acc,
            price: costPrice,
            updatedAt: nowFormatted
          };
        }
      });
    }

    // 5. Cập nhật Bảng Giá Danh Mục Giấy In (PaperMaterials)
    if (costPrice > 0 && Array.isArray(paperItems)) {
      paperItems.forEach((paper, idx) => {
        const pSku = (paper.sku || paper.id || "").toUpperCase().trim();
        const pName = (paper.name || "").toLowerCase().trim();
        const isPaperMatch = (code && (code === pSku || pSku.includes(code) || code.includes(pSku))) ||
                             (name && pName && (pName.includes(name) || name.includes(pName)));
        if (isPaperMatch) {
          paperItemsChanged = true;
          paperItems[idx] = {
            ...paper,
            price: costPrice,
            updatedAt: nowFormatted,
            supplier: receipt.supplier || paper.supplier
          };
        }
      });
    }
  }

  if (boardPricesChanged) {
    await saveBoardCorePricesToFirestore(boardPrices, user).catch(console.error);
  }
  if (accItemsChanged) {
    await saveAccessoryMaterialsToFirestore(accItems, user).catch(console.error);
  }
  if (paperItemsChanged) {
    await savePaperMaterialsToFirestore(paperItems, user).catch(console.error);
  }

  // 6. Sync Ink Imports record if ink items exist
  if (shouldSyncStock && hasInkItems && totalInkQty > 0) {
    const inkRecord: InkImportRecord = {
      id: `ink-from-receipt-${receipt.id}`,
      receiptNumber: receipt.receiptNumber || receipt.id,
      date: receipt.date,
      year: new Date(receipt.date).getFullYear(),
      supplier: receipt.supplier || "SVP",
      items: inkColorQuantities,
      totalQuantity: totalInkQty,
      unit: "Bình",
      costPricePerBottle: totalInkQty > 0 ? Math.round(totalInkCost / totalInkQty) : 0,
      totalCost: totalInkCost,
      notes: `Đồng bộ tự động từ đơn nhập hàng ${receipt.receiptNumber || receipt.id}`,
      createdAt: receipt.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveInkImportToFirestore(inkRecord, user).catch(console.error);
  }

  // Đánh dấu đơn hàng đã được cộng tồn kho thành công
  const docRef = doc(db, COLLECTIONS.PURCHASES, receipt.id);
  await setDoc(docRef, { isSynced: true, syncedAt: new Date().toISOString() }, { merge: true }).catch(console.error);
}

export async function savePurchaseToFirestore(
  receipt: StockImportReceipt,
  user?: AuthUserContext | null,
  materialsList: Material[] = []
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PURCHASES, receipt.id);
  const status = receipt.status || "pending";

  // Revert stock & ink if status changed away from completed after being synced
  if (status !== "completed" && receipt.isSynced) {
    let currentMaterials = materialsList;
    if (!currentMaterials || currentMaterials.length === 0) {
      try {
        const mSnap = await getDocs(collection(db, COLLECTIONS.MATERIALS));
        currentMaterials = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Material));
      } catch (e) {
        console.error("Error fetching materials for status revert:", e);
      }
    }

    for (const item of (receipt.items || [])) {
      const qty = Number(item.quantity) || 0;
      if (qty > 0) {
        const matchedMat = findMatchedMaterial(item, currentMaterials);
        if (matchedMat && isMDFOrFomexMaterial(matchedMat, item)) {
          const currentStock = Number(matchedMat.stockQuantity) || 0;
          const newStock = Math.max(0, currentStock - qty);
          const updatedMat: Material = {
            ...matchedMat,
            stockQuantity: newStock,
            updatedAt: new Date().toISOString()
          };
          await saveMaterialToFirestore(updatedMat, user).catch(console.error);
        }
      }
    }

    await deleteInkImportFromFirestore(`ink-from-receipt-${receipt.id}`).catch(console.error);
    receipt.isSynced = false;
  }

  const enriched = attachUserInfo({
    ...receipt,
    status,
    isSynced: status === "completed" ? (receipt.isSynced || false) : false,
    date: normalizeDateOnly(receipt.date),
    createdAt: normalizeFirestoreDate(receipt.createdAt)
  }, user);

  await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });

  if (status === "completed") {
    await executeStockImportAutoSync(enriched as StockImportReceipt, materialsList, user);
  }
}

export const saveStockImportToFirestore = savePurchaseToFirestore;

export async function deletePurchaseFromFirestore(
  receiptId: string,
  materialsList: Material[] = [],
  user?: AuthUserContext | null,
  targetReceipt?: StockImportReceipt
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PURCHASES, receiptId);
  let receipt = targetReceipt;
  if (!receipt) {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        receipt = { id: snap.id, ...snap.data() } as StockImportReceipt;
      }
    } catch (e) {
      console.error("Error reading receipt before deletion:", e);
    }
  }

  let currentMaterials = materialsList;
  if (!currentMaterials || currentMaterials.length === 0) {
    try {
      const mSnap = await getDocs(collection(db, COLLECTIONS.MATERIALS));
      currentMaterials = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Material));
    } catch (e) {
      console.error("Error fetching materials for deletion stock deduction:", e);
    }
  }

  // If receipt was completed or synced, deduct item quantities from materials stock & ink in Firestore
  if (receipt && (receipt.status === "completed" || receipt.isSynced)) {
    // 1. Deduct MDF & Fomex stock from materials
    for (const item of (receipt.items || [])) {
      const qty = Number(item.quantity) || 0;
      if (qty > 0) {
        const matchedMat = findMatchedMaterial(item, currentMaterials);
        if (matchedMat && isMDFOrFomexMaterial(matchedMat, item)) {
          const currentStock = Number(matchedMat.stockQuantity) || 0;
          const newStock = Math.max(0, currentStock - qty);
          const updatedMat: Material = {
            ...matchedMat,
            stockQuantity: newStock,
            updatedAt: new Date().toISOString()
          };
          await saveMaterialToFirestore(updatedMat, user).catch(console.error);
        }
      }
    }

    // 2. Delete Ink Import Record
    await deleteInkImportFromFirestore(`ink-from-receipt-${receipt.id}`).catch(console.error);
  }

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
// 9.1 BẢNG GIÁ CỐT VẬT TƯ (VÁN MDF 9LI, VÁN MDF 12LI, FOMEX 9LI)
// =================================================================
export const DEFAULT_BOARD_CORE_PRICES: BoardCorePriceMap = {
  '13x18': { size: '13x18', mdf9li: 8000, mdf12li: 10000, fomex9li: 9000, updatedAt: '13/10/2026 08:00' },
  '15x21': { size: '15x21', mdf9li: 10000, mdf12li: 12000, fomex9li: 11000, updatedAt: '13/10/2026 08:00' },
  '1521 9li HQ': { size: '15x21', code: '1521 9li HQ', name: 'Gỗ MDF 1521 9li Viền Hàn Quốc', mdf9li: 15000, mdf12li: 0, fomex9li: 0, updatedAt: '13/10/2026 08:00', isKoreanBorder: true },
  '20x30': { size: '20x30', mdf9li: 14000, mdf12li: 17000, fomex9li: 15000, updatedAt: '13/10/2026 08:00' },
  '2030 9li HQ': { size: '2030 9li HQ', code: '2030 9li HQ', name: 'Gỗ MDF 2030 dày 9 li viền Hàn Quốc', mdf9li: 20000, mdf12li: 0, fomex9li: 0, updatedAt: '13/10/2026 08:00', isKoreanBorder: true },
  '25x38': { size: '25x38', mdf9li: 15000, mdf12li: 18000, fomex9li: 17000, updatedAt: '13/10/2026 08:00' },
  '30x45': { size: '30x45', mdf9li: 16000, mdf12li: 20000, fomex9li: 22000, updatedAt: '13/10/2026 08:00' },
  '35x50': { size: '35x50', mdf9li: 18000, mdf12li: 23000, fomex9li: 25000, updatedAt: '13/10/2026 08:00' },
  '40x60': { size: '40x60', mdf9li: 20265, mdf12li: 26520, fomex9li: 28000, updatedAt: '13/10/2026 08:00' },
  '50x75': { size: '50x75', mdf9li: 26000, mdf12li: 32000, fomex9li: 35000, updatedAt: '13/10/2026 08:00' },
  '60x90': { size: '60x90', mdf9li: 38000, mdf12li: 45000, fomex9li: 48000, updatedAt: '13/10/2026 08:00' },
  '60x120': { size: '60x120', mdf9li: 48000, mdf12li: 58000, fomex9li: 62000, updatedAt: '13/10/2026 08:00' },
  '70x110': { size: '70x110', mdf9li: 55000, mdf12li: 65000, fomex9li: 70000, updatedAt: '13/10/2026 08:00' },
  '80x120': { size: '80x120', mdf9li: 70000, mdf12li: 85000, fomex9li: 90000, updatedAt: '13/10/2026 08:00' },
  '100x150': { size: '100x150', mdf9li: 110000, mdf12li: 135000, fomex9li: 145000, updatedAt: '13/10/2026 08:00' }
};

const BOARD_CORE_PRICES_LOCAL_KEY = 'tiem_in_194_board_core_prices_v1';

export function getLocalBoardCorePrices(): BoardCorePriceMap {
  try {
    const raw = localStorage.getItem(BOARD_CORE_PRICES_LOCAL_KEY);
    if (!raw) return DEFAULT_BOARD_CORE_PRICES;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      delete parsed['20x20'];
      delete parsed['30x30'];
      delete parsed['110x180'];
      delete parsed['120x240'];
      return { ...DEFAULT_BOARD_CORE_PRICES, ...parsed };
    }
    return DEFAULT_BOARD_CORE_PRICES;
  } catch (e) {
    return DEFAULT_BOARD_CORE_PRICES;
  }
}

export function saveLocalBoardCorePrices(prices: BoardCorePriceMap): void {
  try {
    const cleanMap = { ...prices };
    delete cleanMap['20x20'];
    delete cleanMap['30x30'];
    localStorage.setItem(BOARD_CORE_PRICES_LOCAL_KEY, JSON.stringify(cleanMap));
  } catch (e) {
    console.error('Error saving local board core prices:', e);
  }
}

export function subscribeBoardCorePrices(
  onData: (prices: BoardCorePriceMap) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'board_core_prices');
  return onSnapshot(docRef, { includeMetadataChanges: false }, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const prices: BoardCorePriceMap = (raw.prices && typeof raw.prices === 'object') ? raw.prices : {};
      delete prices['20x20'];
      delete prices['30x30'];
      const merged = { ...DEFAULT_BOARD_CORE_PRICES, ...prices };
      delete merged['20x20'];
      delete merged['30x30'];
      saveLocalBoardCorePrices(merged);
      onData(merged);
    } else {
      const initial = getLocalBoardCorePrices();
      onData(initial);
    }
  }, (error) => {
    console.error('Firestore board_core_prices onSnapshot error:', error);
    onData(getLocalBoardCorePrices());
    if (onError) onError(error);
  });
}

export async function saveBoardCorePricesToFirestore(
  prices: BoardCorePriceMap,
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalBoardCorePrices(prices);
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'board_core_prices');
    const payload = {
      prices,
      updatedAt: new Date().toISOString()
    };
    const enriched = attachUserInfo(payload, user);
    await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
  } catch (e) {
    console.error('Error saving board core prices to Firestore:', e);
  }
}

// =================================================================
// 9.2 BẢNG GIÁ VẬT TƯ PHỤ KIỆN (MICA, VIỀN, PHÀO, KEO...)
// =================================================================
// =================================================================
// 9.2 BẢNG GIÁ VẬT TƯ PHỤ KIỆN (MICA, VIỀN, PHÀO, KEO...)
// =================================================================
export const DEFAULT_ACCESSORY_MATERIALS: AccessoryMaterialItem[] = [
  { id: 'acc-1', sku: 'PK-01', name: 'Băng Keo Trong 1kg', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Keo & Phụ kiện' },
  { id: 'acc-2', sku: 'PK-02', name: 'Màng Pe 5kg', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Keo & Phụ kiện' },
  { id: 'acc-3', sku: 'MC-6202', name: 'Mica 62-02', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-4', sku: 'MC-7602', name: 'Mica 76-02', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-5', sku: 'MC-62035', name: 'Mica nhiệt gương 62-035', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-6', sku: 'MC-76035', name: 'Mica nhiệt gương 76-035', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-7', sku: 'MC-10704', name: 'Mica nhiệt gương 107-04', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-8', sku: 'MC-12704', name: 'Mica nhiệt gương 127-04', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-9', sku: 'MC-12702', name: 'Mica nguội 127-02', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-10', sku: 'MC-12703', name: 'Mica nguội 127 - 03', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Mica' },
  { id: 'acc-11', sku: 'VN-12', name: 'Viền 12', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Viền' },
  { id: 'acc-12', sku: 'VN-09', name: 'Viền 9', unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', category: 'Viền' },
  { id: 'acc-13', sku: 'P-3412', name: 'Phào 3412 nâu', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-14', sku: 'P-2V', name: '2v', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-15', sku: 'P-2525', name: 'Phào 2525', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-16', sku: 'P-526', name: 'Phào 526 (521)', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-17', sku: 'P-602', name: 'Phào 602 nâu', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-18', sku: 'P-2009', name: 'Phào 2009 nâu', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-19', sku: 'P-TT1', name: 'Phào Titan 1', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-20', sku: 'P-TT2', name: 'Phào Titan 2', unit: 'Cây', price: 0, updatedAt: '13/10/2026 08:00', category: 'Phào' },
  { id: 'acc-21', sku: 'PK-03', name: 'Keo sữa', unit: 'Thùng', price: 0, updatedAt: '13/10/2026 08:00', category: 'Keo & Phụ kiện' },
  { id: 'acc-22', sku: 'PK-04', name: 'Chân chống sắt', unit: 'Cái', price: 0, updatedAt: '13/10/2026 08:00', category: 'Keo & Phụ kiện' },
  { id: 'acc-23', sku: 'PK-05', name: 'Ke góc nhựa trắng to', unit: 'Cái', price: 0, updatedAt: '13/10/2026 08:00', category: 'Keo & Phụ kiện' },
  { id: 'acc-24', sku: 'PK-06', name: 'Keo hạt', unit: 'Bao', price: 0, updatedAt: '13/10/2026 08:00', category: 'Keo & Phụ kiện' }
];

const ACCESSORY_MATERIALS_LOCAL_KEY = 'tiem_in_194_accessory_materials_v1';

export function generateUniqueAccessorySKU(
  existingItems: AccessoryMaterialItem[],
  category: string = 'Khác',
  name: string = ''
): string {
  const takenSKUs = new Set(
    (existingItems || [])
      .map(i => (i.sku || '').toUpperCase().trim())
      .filter(Boolean)
  );

  let prefix = 'PK';
  const catLower = (category || '').toLowerCase();
  if (catLower.includes('mica')) prefix = 'MC';
  else if (catLower.includes('viền') || catLower.includes('vien')) prefix = 'VN';
  else if (catLower.includes('phào') || catLower.includes('phao')) prefix = 'P';
  else if (catLower.includes('keo') || catLower.includes('phụ kiện')) prefix = 'PK';

  const numbersInName = name.replace(/[^0-9]/g, '');
  if (numbersInName && numbersInName.length >= 2 && numbersInName.length <= 6) {
    const candidate = `${prefix}-${numbersInName}`;
    if (!takenSKUs.has(candidate)) return candidate;
  }

  for (let counter = 1; counter <= 999; counter++) {
    const candidate = `${prefix}-${String(counter).padStart(2, '0')}`;
    if (!takenSKUs.has(candidate)) {
      return candidate;
    }
  }

  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export function ensureUniqueAccessorySKUs(items: AccessoryMaterialItem[]): AccessoryMaterialItem[] {
  // Map predefined default SKUs by item ID or name (case-insensitive)
  const defaultSkuMap = new Map<string, string>();
  DEFAULT_ACCESSORY_MATERIALS.forEach(def => {
    if (def.sku) {
      defaultSkuMap.set(def.id, def.sku);
      defaultSkuMap.set(def.name.toLowerCase().trim(), def.sku);
    }
  });

  const takenSKUs = new Set<string>();

  return (items || []).map(item => {
    let sku = (item.sku || '').toUpperCase().trim();

    // 1. If SKU is missing, first try looking up standard default SKU by ID or Name
    if (!sku) {
      const knownSku = defaultSkuMap.get(item.id) || defaultSkuMap.get((item.name || '').toLowerCase().trim());
      if (knownSku && !takenSKUs.has(knownSku.toUpperCase())) {
        sku = knownSku.toUpperCase();
      }
    }

    // 2. If still missing or duplicate, generate a unique SKU
    if (!sku || takenSKUs.has(sku)) {
      sku = generateUniqueAccessorySKU(items, item.category, item.name);
    }

    takenSKUs.add(sku);
    return {
      ...item,
      sku
    };
  });
}

export function getLocalAccessoryMaterials(): AccessoryMaterialItem[] {
  try {
    const raw = localStorage.getItem(ACCESSORY_MATERIALS_LOCAL_KEY);
    if (!raw) {
      const initial = ensureUniqueAccessorySKUs(DEFAULT_ACCESSORY_MATERIALS);
      saveLocalAccessoryMaterials(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingIds = new Set(parsed.map((item: AccessoryMaterialItem) => item.id));
      const missingDefaults = DEFAULT_ACCESSORY_MATERIALS.filter(def => !existingIds.has(def.id));
      const merged = [...parsed, ...missingDefaults];
      const ensured = ensureUniqueAccessorySKUs(merged);
      saveLocalAccessoryMaterials(ensured);
      return ensured;
    }
    const initial = ensureUniqueAccessorySKUs(DEFAULT_ACCESSORY_MATERIALS);
    saveLocalAccessoryMaterials(initial);
    return initial;
  } catch (e) {
    const fallback = ensureUniqueAccessorySKUs(DEFAULT_ACCESSORY_MATERIALS);
    saveLocalAccessoryMaterials(fallback);
    return fallback;
  }
}

export function saveLocalAccessoryMaterials(items: AccessoryMaterialItem[]): void {
  try {
    localStorage.setItem(ACCESSORY_MATERIALS_LOCAL_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving local accessory materials:', e);
  }
}

export function subscribeAccessoryMaterials(
  onData: (items: AccessoryMaterialItem[]) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'accessory_materials');
  return onSnapshot(docRef, { includeMetadataChanges: false }, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const items: AccessoryMaterialItem[] = Array.isArray(raw.items) ? raw.items : [];
      if (items.length === 0) {
        const initial = getLocalAccessoryMaterials();
        onData(initial);
      } else {
        const existingIds = new Set(items.map(item => item.id));
        const missingDefaults = DEFAULT_ACCESSORY_MATERIALS.filter(def => !existingIds.has(def.id));
        const merged = [...items, ...missingDefaults];
        saveLocalAccessoryMaterials(merged);
        onData(merged);
      }
    } else {
      const initial = getLocalAccessoryMaterials();
      onData(initial);
    }
  }, (error) => {
    console.error('Firestore accessory_materials onSnapshot error:', error);
    onData(getLocalAccessoryMaterials());
    if (onError) onError(error);
  });
}

export async function saveAccessoryMaterialsToFirestore(
  items: AccessoryMaterialItem[],
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalAccessoryMaterials(items);
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'accessory_materials');
    const payload = {
      items,
      updatedAt: new Date().toISOString()
    };
    const enriched = attachUserInfo(payload, user);
    await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
  } catch (e) {
    console.error('Error saving accessory materials to Firestore:', e);
  }
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

// ==========================================
// 12. SỔ THEO DÕI DOANH THU MẪU S1a (PARTNER)
// ==========================================

const LOCAL_STORAGE_S1A_OVERRIDES = 'xuongin194_s1a_overrides';
const LOCAL_STORAGE_S1A_MANUAL = 'xuongin194_s1a_manual_entries';

export function getLocalS1aOverrides(): Record<string, S1aDayOverride> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_S1A_OVERRIDES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalS1aOverrides(data: Record<string, S1aDayOverride>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_S1A_OVERRIDES, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving local s1a overrides', e);
  }
}

export function subscribeS1aOverrides(
  onData: (overrides: Record<string, S1aDayOverride>) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 's1a_overrides');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const cleanData: Record<string, S1aDayOverride> = {};
      Object.entries(raw).forEach(([k, v]) => {
        if (k !== 'updatedAt' && k !== 'userId' && k !== 'createdBy' && typeof v === 'object' && v !== null) {
          cleanData[k] = v as S1aDayOverride;
        }
      });
      saveLocalS1aOverrides(cleanData);
      onData(cleanData);
    } else {
      onData(getLocalS1aOverrides());
    }
  }, (err) => {
    console.error('Firestore s1a_overrides onSnapshot error:', err);
    onData(getLocalS1aOverrides());
    if (onError) onError(err);
  });
}

export async function saveS1aOverridesToFirestore(
  overrides: Record<string, S1aDayOverride>,
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalS1aOverrides(overrides);
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 's1a_overrides');
    const enriched = attachUserInfo({
      ...overrides,
      updatedAt: new Date().toISOString()
    }, user);
    await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
  } catch (e) {
    console.error('Error syncing s1a_overrides to Firestore:', e);
  }
}

export function getLocalS1aManualEntries(): S1aManualEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_S1A_MANUAL);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalS1aManualEntries(entries: S1aManualEntry[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_S1A_MANUAL, JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving local s1a manual entries', e);
  }
}

export function subscribeS1aManualEntries(
  onData: (entries: S1aManualEntry[]) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 's1a_manual_entries');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const list = Array.isArray(raw?.entries) ? (raw.entries as S1aManualEntry[]) : [];
      saveLocalS1aManualEntries(list);
      onData(list);
    } else {
      onData(getLocalS1aManualEntries());
    }
  }, (err) => {
    console.error('Firestore s1a_manual_entries onSnapshot error:', err);
    onData(getLocalS1aManualEntries());
    if (onError) onError(err);
  });
}

export async function saveS1aManualEntriesToFirestore(
  entries: S1aManualEntry[],
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalS1aManualEntries(entries);
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 's1a_manual_entries');
    const enriched = attachUserInfo({
      entries,
      updatedAt: new Date().toISOString()
    }, user);
    await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
  } catch (e) {
    console.error('Error syncing s1a_manual_entries to Firestore:', e);
  }
}





// =================================================================
// 9.3 DANH MỤC GIẤY IN (GIẤY RC BÓNG & GIẤY PP KHỔ 51->111)
// =================================================================
export const DEFAULT_PAPER_MATERIALS: PaperMaterialItem[] = [
  // GIẤY RC BÓNG
  { id: 'G-RC-51', sku: 'G-RC-51', name: 'Giấy RC bóng khổ 51', paperType: 'Giấy RC bóng', widthSize: 51, unit: 'Cuộn', price: 612000, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-RC-61', sku: 'G-RC-61', name: 'Giấy RC bóng khổ 61', paperType: 'Giấy RC bóng', widthSize: 61, unit: 'Cuộn', price: 732000, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-RC-76', sku: 'G-RC-76', name: 'Giấy RC bóng khổ 76', paperType: 'Giấy RC bóng', widthSize: 76, unit: 'Cuộn', price: 684000, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-RC-91', sku: 'G-RC-91', name: 'Giấy RC bóng khổ 91', paperType: 'Giấy RC bóng', widthSize: 91, unit: 'Cuộn', price: 822600, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-RC-111', sku: 'G-RC-111', name: 'Giấy RC bóng khổ 111', paperType: 'Giấy RC bóng', widthSize: 111, unit: 'Cuộn', price: 1006200, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },

  // GIẤY PP
  { id: 'G-PP-51', sku: 'G-PP-51', name: 'Giấy PP khổ 51', paperType: 'Giấy PP', widthSize: 51, unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-PP-61', sku: 'G-PP-61', name: 'Giấy PP khổ 61', paperType: 'Giấy PP', widthSize: 61, unit: 'Cuộn', price: 671000, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-PP-76', sku: 'G-PP-76', name: 'Giấy PP khổ 76', paperType: 'Giấy PP', widthSize: 76, unit: 'Cuộn', price: 836000, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-PP-91', sku: 'G-PP-91', name: 'Giấy PP khổ 91', paperType: 'Giấy PP', widthSize: 91, unit: 'Cuộn', price: 1005000, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
  { id: 'G-PP-111', sku: 'G-PP-111', name: 'Giấy PP khổ 111', paperType: 'Giấy PP', widthSize: 111, unit: 'Cuộn', price: 1229000, updatedAt: '13/10/2026 08:00', supplier: 'SVP' },
];

const PAPER_MATERIALS_LOCAL_KEY = 'tiem_in_194_paper_materials_v1';

export function getLocalPaperMaterials(): PaperMaterialItem[] {
  try {
    const raw = localStorage.getItem(PAPER_MATERIALS_LOCAL_KEY);
    if (!raw) return DEFAULT_PAPER_MATERIALS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingIds = new Set(parsed.map((item: PaperMaterialItem) => item.id || item.sku));
      const missing = DEFAULT_PAPER_MATERIALS.filter(item => !existingIds.has(item.id));
      return [...parsed, ...missing];
    }
    return DEFAULT_PAPER_MATERIALS;
  } catch (e) {
    return DEFAULT_PAPER_MATERIALS;
  }
}

export function saveLocalPaperMaterials(items: PaperMaterialItem[]): void {
  try {
    localStorage.setItem(PAPER_MATERIALS_LOCAL_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving local paper materials:', e);
  }
}

export function subscribePaperMaterials(
  onData: (items: PaperMaterialItem[]) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'paper_materials');
  return onSnapshot(docRef, { includeMetadataChanges: false }, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const items: PaperMaterialItem[] = Array.isArray(raw.items) ? raw.items : [];
      if (items.length > 0) {
        const existingIds = new Set(items.map((i: PaperMaterialItem) => i.id || i.sku));
        const missing = DEFAULT_PAPER_MATERIALS.filter(i => !existingIds.has(i.id));
        const merged = [...items, ...missing];
        saveLocalPaperMaterials(merged);
        onData(merged);
      } else {
        const initial = getLocalPaperMaterials();
        onData(initial);
      }
    } else {
      const initial = getLocalPaperMaterials();
      onData(initial);
    }
  }, (error) => {
    console.error('Firestore paper_materials onSnapshot error:', error);
    onData(getLocalPaperMaterials());
    if (onError) onError(error);
  });
}

export async function savePaperMaterialsToFirestore(
  items: PaperMaterialItem[],
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalPaperMaterials(items);
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'paper_materials');
    const payload = {
      items,
      updatedAt: new Date().toISOString()
    };
    const enriched = attachUserInfo(payload, user);
    await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
  } catch (e) {
    console.error('Error saving paper materials to Firestore:', e);
  }
}

// =================================================================
// 10. ARCHIVED DELETED CUSTOMER REVENUES (BẢO LƯU DOANH THU NĂM KHI XÓA KHÁCH HÀNG)
// =================================================================
const ARCHIVED_DELETED_CUSTOMERS_KEY = 'xuongin194_archived_deleted_customers_v1';

export function getLocalArchivedCustomerRevenues(): ArchivedDeletedCustomerRevenue[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_DELETED_CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalArchivedCustomerRevenues(records: ArchivedDeletedCustomerRevenue[]): void {
  try {
    localStorage.setItem(ARCHIVED_DELETED_CUSTOMERS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving local archived customer revenues:', e);
  }
}

export function subscribeArchivedCustomerRevenues(
  onData: (records: ArchivedDeletedCustomerRevenue[]) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'archived_deleted_customers');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const records = Array.isArray(raw?.records) ? raw.records : [];
      saveLocalArchivedCustomerRevenues(records);
      onData(records);
    } else {
      onData(getLocalArchivedCustomerRevenues());
    }
  }, (err) => {
    console.error('Firestore subscribeArchivedCustomerRevenues error:', err);
    onData(getLocalArchivedCustomerRevenues());
    if (onError) onError(err);
  });
}

export async function saveArchivedCustomerRevenuesToFirestore(
  records: ArchivedDeletedCustomerRevenue[],
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalArchivedCustomerRevenues(records);
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'archived_deleted_customers');
    const payload = {
      records,
      updatedAt: new Date().toISOString()
    };
    const enriched = attachUserInfo(payload, user);
    await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
  } catch (e) {
    console.error('Error saving archived deleted customers to Firestore:', e);
  }
}

// =================================================================
// 11. OTHER EXPENSES (CHI PHÍ KHÁC: LƯƠNG, MẶT BẰNG, ĐIỆN, NƯỚC, PHÁT SINH)
// =================================================================
const STORAGE_KEY_OTHER_EXPENSES = 'xuongin194_other_expenses_v1';

export function getLocalOtherExpenses(): OtherExpensesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OTHER_EXPENSES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalOtherExpenses(data: OtherExpensesMap): void {
  try {
    localStorage.setItem(STORAGE_KEY_OTHER_EXPENSES, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving local other expenses:', e);
  }
}

export function subscribeOtherExpenses(
  onData: (expenses: OtherExpensesMap) => void,
  onError?: (err: Error) => void
) {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'other_expenses');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data();
      const cleanData: OtherExpensesMap = {};
      Object.entries(raw).forEach(([k, v]) => {
        if (k !== 'updatedAt' && k !== 'userId' && k !== 'createdBy' && typeof v === 'object' && v !== null) {
          const item = v as any;
          cleanData[k] = {
            salary: Number(item.salary) || 0,
            rent: Number(item.rent) || 0,
            electricity: Number(item.electricity) || 0,
            water: Number(item.water) || 0,
            other: Number(item.other) || 0,
            note: item.note || undefined
          };
        }
      });
      saveLocalOtherExpenses(cleanData);
      onData(cleanData);
    } else {
      onData(getLocalOtherExpenses());
    }
  }, (err) => {
    console.error('Firestore subscribeOtherExpenses error:', err);
    onData(getLocalOtherExpenses());
    if (onError) onError(err);
  });
}

export async function saveOtherExpensesToFirestore(
  data: OtherExpensesMap,
  user?: AuthUserContext | null
): Promise<void> {
  saveLocalOtherExpenses(data);
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'other_expenses');
    const enriched = attachUserInfo({
      ...data,
      updatedAt: new Date().toISOString()
    }, user);
    await setDoc(docRef, cleanFirestoreObject(enriched), { merge: true });
  } catch (e) {
    console.error('Error saving other expenses to Firestore:', e);
  }
}


