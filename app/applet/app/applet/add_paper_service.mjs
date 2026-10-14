import fs from 'fs';

let code = fs.readFileSync('src/services/firestoreService.ts', 'utf8');

// 1. Add import for PaperMaterialItem
if (!code.includes('PaperMaterialItem')) {
  code = code.replace(
    'AccessoryMaterialItem, AccessoryMaterialMap } from \'../types\';',
    'AccessoryMaterialItem, AccessoryMaterialMap, PaperMaterialItem, PaperMaterialMap } from \'../types\';'
  );
}

// 2. Add DEFAULT_PAPER_MATERIALS and paper CRUD functions
const paperServiceCode = `
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
  { id: 'G-PP-51', sku: 'G-PP-51', name: 'Giấy PP khổ 51', paperType: 'Giấy PP', widthSize: 51, unit: 'Cuộn', price: 0, updatedAt: '13/10/2026 08:00', supplier: 'Toản HN' },
  { id: 'G-PP-61', sku: 'G-PP-61', name: 'Giấy PP khổ 61', paperType: 'Giấy PP', widthSize: 61, unit: 'Cuộn', price: 671000, updatedAt: '13/10/2026 08:00', supplier: 'Toản HN' },
  { id: 'G-PP-76', sku: 'G-PP-76', name: 'Giấy PP khổ 76', paperType: 'Giấy PP', widthSize: 76, unit: 'Cuộn', price: 836000, updatedAt: '13/10/2026 08:00', supplier: 'Toản HN' },
  { id: 'G-PP-91', sku: 'G-PP-91', name: 'Giấy PP khổ 91', paperType: 'Giấy PP', widthSize: 91, unit: 'Cuộn', price: 1005000, updatedAt: '13/10/2026 08:00', supplier: 'Toản HN' },
  { id: 'G-PP-111', sku: 'G-PP-111', name: 'Giấy PP khổ 111', paperType: 'Giấy PP', widthSize: 111, unit: 'Cuộn', price: 1229000, updatedAt: '13/10/2026 08:00', supplier: 'Toản HN' },
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
`;

if (!code.includes('DEFAULT_PAPER_MATERIALS')) {
  code += '\n' + paperServiceCode;
}

// 3. Update executeStockImportAutoSync to sync paper prices
const oldSyncCode = `  if (accItemsChanged) {
    await saveAccessoryMaterialsToFirestore(accItems, user).catch(console.error);
  }
}`;

const newSyncCode = `  if (accItemsChanged) {
    await saveAccessoryMaterialsToFirestore(accItems, user).catch(console.error);
  }

  // 4. Cập nhật Bảng Giá Danh Mục Giấy In (PaperMaterials)
  const paperItems = [...getLocalPaperMaterials()];
  let paperItemsChanged = false;

  for (const item of (receipt.items || [])) {
    const code = (item.materialCode || '').toUpperCase().trim();
    const name = (item.materialName || '').toLowerCase().trim();
    const costPrice = Number(item.costPrice) || 0;

    if (costPrice > 0 && Array.isArray(paperItems)) {
      paperItems.forEach((paper, idx) => {
        const pSku = (paper.sku || paper.id || '').toUpperCase().trim();
        const pName = (paper.name || '').toLowerCase().trim();

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

  if (paperItemsChanged) {
    await savePaperMaterialsToFirestore(paperItems, user).catch(console.error);
  }
}`;

if (code.includes(oldSyncCode)) {
  code = code.replace(oldSyncCode, newSyncCode);
}

// 4. Update DEFAULT_PRESET_ITEMS to include paper SKUs
if (!code.includes('Giấy RC bóng khổ 51')) {
  const oldPresets = `export const DEFAULT_PRESET_ITEMS = [
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
];`;

  const newPresets = `export const DEFAULT_PRESET_ITEMS = [
  'Giấy RC bóng khổ 51',
  'Giấy RC bóng khổ 61',
  'Giấy RC bóng khổ 76',
  'Giấy RC bóng khổ 91',
  'Giấy RC bóng khổ 111',
  'Giấy PP khổ 51',
  'Giấy PP khổ 61',
  'Giấy PP khổ 76',
  'Giấy PP khổ 91',
  'Giấy PP khổ 111',
  'Bình Mực Lucia Pro',
  'Ván MDF 9li',
  'Ván MDF 12li',
  'Fomex 9li',
  'Mica 62-03',
  'Màng lụa bóng',
  'Nẹp Viền',
  'Keo dán',
  'Khác'
];`;

  if (code.includes(oldPresets)) {
    code = code.replace(oldPresets, newPresets);
  }
}

fs.writeFileSync('src/services/firestoreService.ts', code, 'utf8');
console.log('Updated src/services/firestoreService.ts successfully!');
