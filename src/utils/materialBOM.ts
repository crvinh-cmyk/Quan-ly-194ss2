import { OrderItem, Material, MaterialDeduction, Product, Order } from '../types';
import { getProductCoreType } from './productHelpers';

export interface BOMRequirement {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantityNeeded: number;
  currentStock: number;
  remainingStockAfterOrder: number;
  isLowStockWarning: boolean;
  isOutOfStockError: boolean;
  reason: string; // e.g. "1 tấm gỗ cốt 60x90 cho Ảnh Cổng 60x90"
}

export interface MaterialUsageInfo {
  usedQuantity: number;
  orderCount: number;
  lastUsedDate?: string;
  orderNumbers: string[];
}

// Normalize size strings like "60x90", "60 x 90", "60*90" -> "6090"
export function normalizeSize(size: string): string {
  if (!size) return '';
  return size.toLowerCase().replace(/[^0-9]/g, '');
}

/**
 * Extracts effective dimension like "60x90" from size field or product name/code
 */
export function extractEffectiveSize(size?: string, name?: string, code?: string): string {
  if (size && size.trim()) {
    const m = size.match(/(\d{1,3})\s*[xX*_\-]\s*(\d{1,3})/);
    if (m) return `${m[1]}*${m[2]}`;
    return size.trim();
  }
  const text = `${name || ''} ${code || ''}`;
  const match = text.match(/(\d{1,3})\s*[xX*_\-]\s*(\d{1,3})/);
  if (match) {
    return `${match[1]}*${match[2]}`;
  }
  return '';
}

/**
 * Tự động xác định hoặc tra cứu Cốt Vật Tư Tương Thích (materialCoreCode)
 * Cho sản phẩm trong Bảng Giá hoặc dòng hàng trong Hóa Đơn Bán Hàng:
 * 1. Ưu tiên 1: Mã cốt vật tư thủ công (materialCoreCode) đã gán trên sản phẩm hoặc dòng hàng
 * 2. Ưu tiên 2: Tra cứu mã sản phẩm trong danh mục sản phẩm (catalogProducts)
 * 3. Ưu tiên 3: Tự động phân loại theo quy chuẩn Tiệm In 194 (Fomex 9li cho 4K/HD Pro, Ván MDF cho các ảnh khác, Không cốt cho In/Ép/Album/Khung)
 */
export function resolveProductCoreMaterial(
  prod: {
    code?: string;
    name?: string;
    size?: string;
    note?: string;
    description?: string;
    materialCoreCode?: string;
    materialCoreName?: string;
    materialCoreId?: string;
  },
  materials: Material[],
  catalogProducts?: Product[]
): {
  materialCoreCode: string;
  materialCoreName: string;
  materialCoreId?: string;
  isNone: boolean;
} {
  // 1. Kiểm tra trực tiếp trên prod (nếu là OrderItem hoặc Product đã có materialCoreCode)
  let explicitCode = (prod.materialCoreCode || '').trim();
  let explicitName = (prod.materialCoreName || '').trim();
  let explicitId = prod.materialCoreId;

  // 1b. Nếu chưa có trên prod, tìm sản phẩm tương ứng trong catalogProducts theo mã sản phẩm
  if (!explicitCode && catalogProducts && prod.code) {
    const cleanProdCode = prod.code.toUpperCase().trim();
    const matched = catalogProducts.find(p => p.code.toUpperCase().trim() === cleanProdCode);
    if (matched && matched.materialCoreCode) {
      explicitCode = matched.materialCoreCode.trim();
      explicitName = (matched.materialCoreName || '').trim();
      explicitId = matched.materialCoreId;
    }
  }

  if (explicitCode) {
    const upper = explicitCode.toUpperCase();
    if (upper === 'NONE' || upper === 'KHONG' || upper === 'KHONG_COT' || upper === '0') {
      return {
        materialCoreCode: 'NONE',
        materialCoreName: 'Không dùng cốt ván',
        materialCoreId: undefined,
        isNone: true
      };
    }

    // Tìm chính xác trong kho vật tư theo mã hoặc id
    const matchedMat = materials.find(
      m => m.code.toUpperCase() === upper || (explicitId && m.id === explicitId)
    );

    if (matchedMat) {
      return {
        materialCoreCode: matchedMat.code,
        materialCoreName: matchedMat.name,
        materialCoreId: matchedMat.id,
        isNone: false
      };
    }

    return {
      materialCoreCode: upper,
      materialCoreName: explicitName || upper,
      materialCoreId: explicitId,
      isNone: false
    };
  }

  // 2. Fallback: Tự động phân loại theo quy chuẩn Tiệm In 194
  const coreType = getProductCoreType(prod);
  if (coreType === 'none') {
    return {
      materialCoreCode: 'NONE',
      materialCoreName: 'Không dùng cốt ván',
      materialCoreId: undefined,
      isNone: true
    };
  }

  const effectiveSize = extractEffectiveSize(prod.size, prod.name, prod.code);
  const normSize = normalizeSize(effectiveSize);

  if (coreType === 'fomex') {
    const fomexMat = materials.find(m => m.category === 'Fomex siêu nhẹ' && normSize && normalizeSize(m.code).includes(normSize))
      || materials.find(m => m.category === 'Fomex siêu nhẹ');
    if (fomexMat) {
      return {
        materialCoreCode: fomexMat.code,
        materialCoreName: fomexMat.name,
        materialCoreId: fomexMat.id,
        isNone: false
      };
    }
    return {
      materialCoreCode: normSize ? `VT-FOMEX-${normSize}` : 'VT-FOMEX-9LI',
      materialCoreName: `Fomex 9li ${effectiveSize || ''}`.trim(),
      isNone: false
    };
  }

  // Gỗ MDF:
  const mdfMat = materials.find(m => m.category === 'Gỗ MDF' && normSize && normalizeSize(m.code).includes(normSize))
    || materials.find(m => m.category === 'Gỗ MDF');
  if (mdfMat) {
    return {
      materialCoreCode: mdfMat.code,
      materialCoreName: mdfMat.name,
      materialCoreId: mdfMat.id,
      isNone: false
    };
  }

  return {
    materialCoreCode: normSize ? `VT-GO-${normSize}` : 'VT-GO-MDF',
    materialCoreName: `Gỗ MDF ${effectiveSize || ''}`.trim(),
    isNone: false
  };
}

/**
 * Calculates raw materials for a SINGLE item in the sales invoice
 */
export function calculateItemBOM(
  item: OrderItem,
  materials: Material[],
  products?: Product[]
): { material: Material; quantity: number; reason: string }[] {
  if (!item.quantity || item.quantity <= 0) return [];

  // 1. If item has custom materials specified by user
  if (item.customMaterials && item.customMaterials.length > 0) {
    const list: { material: Material; quantity: number; reason: string }[] = [];
    item.customMaterials.forEach(cm => {
      const mat = materials.find(m => m.id === cm.materialId || m.code === cm.materialCode);
      if (mat) {
        list.push({
          material: mat,
          quantity: cm.quantity * item.quantity,
          reason: `Vật tư cấu thành tùy chỉnh cho ${item.productName || item.productCode} (${item.size})`
        });
      }
    });
    return list;
  }

  // 2. If matching product has defined recipe
  const matchingProd = products?.find(
    p => p.code.toLowerCase() === (item.productCode || '').trim().toLowerCase()
  );
  if (matchingProd?.recipe && matchingProd.recipe.length > 0) {
    const list: { material: Material; quantity: number; reason: string }[] = [];
    matchingProd.recipe.forEach(rc => {
      const mat = materials.find(m => m.id === rc.materialId || m.code === rc.materialCode);
      if (mat) {
        list.push({
          material: mat,
          quantity: rc.quantityPerProduct * item.quantity,
          reason: `Định mức công thức cho ${matchingProd.name} (${matchingProd.size})`
        });
      }
    });
    return list;
  }

  // 2.5. Ưu tiên cao nhất: Kiểm tra mã cốt vật tư tương thích (materialCoreCode)
  // Được cấu hình trực tiếp từ Bảng Giá Sản Phẩm hoặc gán trên dòng hóa đơn bán hàng
  const explicitCoreCode = (item.materialCoreCode || matchingProd?.materialCoreCode || '').trim();
  const explicitCoreId = item.materialCoreId || matchingProd?.materialCoreId;

  if (explicitCoreCode) {
    const upperCore = explicitCoreCode.toUpperCase();
    // Nếu được chỉ định là KHÔNG CỐT (NONE) -> Tuyệt đối không trừ cốt kho
    if (upperCore === 'NONE' || upperCore === 'KHONG' || upperCore === 'KHONG_COT' || upperCore === '0') {
      return [];
    }

    // Tìm chính xác vật tư trong kho theo Mã hoặc ID
    const directMat = materials.find(
      m => m.code.toUpperCase() === upperCore || (explicitCoreId && m.id === explicitCoreId)
    );

    if (directMat) {
      return [{
        material: directMat,
        quantity: item.quantity * 1,
        reason: `${item.quantity} ${directMat.unit} ${directMat.name} (Cốt tương thích chuẩn: ${directMat.code})`
      }];
    }
  }

  // 3. Quy chuẩn định mức tinh giản theo yêu cầu Tiệm In 194 (Fallback):
  // - Bỏ trống cốt (KHÔNG TRỪ VẬT TƯ CỐT): In ảnh, In ép, Khung gia cố (NEP), Album mở phẳng, Photobook, Tạp chí
  // - CỐT FOMEX 9LI SIÊU NHẸ: DUY NHẤT dành cho "Ảnh 4K" và "Ảnh HD Pro"
  // - CỐT VÁN GỖ MDF: Tất cả các dòng ảnh còn lại (HD Gương Siêu Bóng, Lụa Viền, Mika, Lụa Khung, Ép Gỗ, Tráng Gương, Pha Lê...)
  const coreType = getProductCoreType({
    code: item.productCode,
    name: item.productName,
    note: item.note,
    materialCoreCode: explicitCoreCode
  });

  // Nếu là sản phẩm bỏ trống cốt -> Không trừ cốt ván MDF / Fomex
  if (coreType === 'none') {
    return [];
  }

  const effectiveSize = extractEffectiveSize(item.size, item.productName, item.productCode);
  const normItemSize = normalizeSize(effectiveSize);
  const result: { material: Material; quantity: number; reason: string }[] = [];

  if (coreType === 'fomex') {
    // 1. TẤM FOMEX SIÊU NHẸ 9LI (Chỉ dùng cho ảnh 4K và ảnh HD Pro)
    const fomexMat = materials.find(m => {
      if (m.category !== 'Fomex siêu nhẹ') return false;
      const normMatCode = normalizeSize(m.code);
      const normMatName = normalizeSize(m.name);
      return (
        (normItemSize && (normMatCode.includes(normItemSize) || normMatName.includes(normItemSize))) ||
        (effectiveSize && m.name.toLowerCase().includes(effectiveSize.toLowerCase()))
      );
    }) || materials.find(m => m.category === 'Fomex siêu nhẹ');

    if (fomexMat) {
      result.push({
        material: fomexMat,
        quantity: item.quantity * 1,
        reason: `${item.quantity} tấm Fomex siêu nhẹ 9li cho ${item.productName || item.productCode} (${effectiveSize || 'tiêu chuẩn'})`
      });
    }
  } else {
    // 2. TẤM VÁN MDF (Cho tất cả các loại ảnh khác: HD gương siêu bóng, lụa viền, mika bo viền, lụa khung, ép gỗ, ảnh cổng cưới, để bàn...)
    const woodMat = materials.find(m => {
      if (m.category !== 'Gỗ MDF') return false;
      const normMatCode = normalizeSize(m.code);
      const normMatName = normalizeSize(m.name);
      return (
        (normItemSize && (normMatCode.includes(normItemSize) || normMatName.includes(normItemSize))) ||
        (effectiveSize && m.name.toLowerCase().includes(effectiveSize.toLowerCase()))
      );
    }) || materials.find(m => m.category === 'Gỗ MDF');

    if (woodMat) {
      result.push({
        material: woodMat,
        quantity: item.quantity * 1,
        reason: `${item.quantity} tấm Ván MDF làm cốt gỗ cho ${item.productName || item.productCode} (${effectiveSize || 'tiêu chuẩn'})`
      });
    }
  }

  return result;
}

/**
 * Calculates all raw materials required for an entire order based on items in the cart
 */
export function calculateOrderBOM(
  items: OrderItem[],
  materials: Material[],
  products?: Product[]
): BOMRequirement[] {
  const requirementMap = new Map<string, {
    material: Material;
    quantity: number;
    reasons: string[];
  }>();

  items.forEach(item => {
    if (!item.quantity || item.quantity <= 0) return;
    if (!item.productCode.trim() && !item.productName.trim() && item.amount <= 0) return;

    const itemRequirements = calculateItemBOM(item, materials, products);
    itemRequirements.forEach(({ material, quantity, reason }) => {
      const cur = requirementMap.get(material.id) || { material, quantity: 0, reasons: [] };
      cur.quantity += quantity;
      cur.reasons.push(reason);
      requirementMap.set(material.id, cur);
    });
  });

  // Convert map to list of BOMRequirement
  const result: BOMRequirement[] = [];

  requirementMap.forEach(({ material, quantity, reasons }) => {
    const curStock = material.stockQuantity || 0;
    const roundedQty = Math.round(quantity * 100) / 100;
    const remaining = Math.round((curStock - roundedQty) * 100) / 100;

    result.push({
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      unit: material.unit,
      quantityNeeded: roundedQty,
      currentStock: curStock,
      remainingStockAfterOrder: remaining,
      isLowStockWarning: remaining <= material.minStockAlert && remaining >= 0,
      isOutOfStockError: remaining < 0,
      reason: reasons.join('; ')
    });
  });

  return result;
}

/**
 * Converts BOMRequirement into MaterialDeduction records to attach to the Order
 */
export function createMaterialDeductionRecords(bom: BOMRequirement[]): MaterialDeduction[] {
  return bom.map(b => ({
    materialId: b.materialId,
    materialCode: b.materialCode,
    materialName: b.materialName,
    unit: b.unit,
    quantity: b.quantityNeeded
  }));
}

/**
 * Calculates summary of materials USED across all orders
 */
export function getMaterialUsageSummary(
  orders: Order[],
  materials: Material[],
  products?: Product[]
): Record<string, MaterialUsageInfo> {
  const map: Record<string, MaterialUsageInfo> = {};

  // Initialize for all materials in warehouse
  materials.forEach(mat => {
    map[mat.id] = { usedQuantity: 0, orderCount: 0, orderNumbers: [] };
  });

  const validOrders = orders.filter(o => o.status !== 'cancelled');

  validOrders.forEach(order => {
    // If order has explicitly recorded materialsDeducted
    if (order.materialsDeducted && order.materialsDeducted.length > 0) {
      order.materialsDeducted.forEach(ded => {
        const targetMat = materials.find(m => m.id === ded.materialId || m.code === ded.materialCode);
        const targetId = targetMat ? targetMat.id : ded.materialId;

        if (!map[targetId]) {
          map[targetId] = { usedQuantity: 0, orderCount: 0, orderNumbers: [] };
        }
        map[targetId].usedQuantity += ded.quantity;
        map[targetId].orderCount += 1;
        if (!map[targetId].orderNumbers.includes(order.orderNumber)) {
          map[targetId].orderNumbers.push(order.orderNumber);
        }
        if (!map[targetId].lastUsedDate || order.date > map[targetId].lastUsedDate!) {
          map[targetId].lastUsedDate = order.date;
        }
      });
    } else if (order.items && order.items.length > 0) {
      // Dynamic calculation for orders that did not have materialsDeducted stored
      const calculatedBOM = calculateOrderBOM(order.items, materials, products);
      calculatedBOM.forEach(bom => {
        if (!map[bom.materialId]) {
          map[bom.materialId] = { usedQuantity: 0, orderCount: 0, orderNumbers: [] };
        }
        map[bom.materialId].usedQuantity += bom.quantityNeeded;
        map[bom.materialId].orderCount += 1;
        if (!map[bom.materialId].orderNumbers.includes(order.orderNumber)) {
          map[bom.materialId].orderNumbers.push(order.orderNumber);
        }
        if (!map[bom.materialId].lastUsedDate || order.date > map[bom.materialId].lastUsedDate!) {
          map[bom.materialId].lastUsedDate = order.date;
        }
      });
    }
  });

  // Clean rounding
  Object.keys(map).forEach(key => {
    map[key].usedQuantity = Math.round(map[key].usedQuantity * 100) / 100;
  });

  return map;
}
