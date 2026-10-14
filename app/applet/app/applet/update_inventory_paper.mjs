import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryManagementView.tsx', 'utf8');

// 1. Add getLocalPaperMaterials to imports if not present
if (!code.includes('getLocalPaperMaterials')) {
  code = code.replace(
    'getLocalAccessoryMaterials\n} from \'../services/firestoreService\';',
    'getLocalAccessoryMaterials,\n  getLocalPaperMaterials\n} from \'../services/firestoreService\';'
  );
}

// 2. Add paper SKUs to availableSKUsList in InventoryManagementView
const targetSKUs = `    // 3. Accessory Prices
    try {
      const accItems = getLocalAccessoryMaterials();
      (accItems || []).forEach(acc => {
        if (!skus.some(s => s.id === acc.id || s.name.toLowerCase() === acc.name.toLowerCase())) {
          skus.push({
            id: acc.id,
            code: acc.id.toUpperCase(),
            name: acc.name,
            unit: 'Cái',
            price: acc.price || 0,
            category: acc.category || 'Phụ kiện',
            source: 'accessory'
          });
        }
      });
    } catch (e) {}`;

const replacementSKUs = targetSKUs + `

    // 4. Paper Materials (Giấy RC Bóng & Giấy PP)
    try {
      const paperItems = getLocalPaperMaterials();
      (paperItems || []).forEach(p => {
        if (!skus.some(s => s.code.toUpperCase() === p.sku.toUpperCase())) {
          skus.push({
            id: p.id,
            code: p.sku,
            name: p.name,
            unit: p.unit || 'Cuộn',
            price: p.price || 0,
            category: \`Giấy In (\${p.paperType})\`,
            source: 'inventory'
          });
        }
      });
    } catch (e) {}`;

if (!code.includes('// 4. Paper Materials')) {
  code = code.replace(targetSKUs, replacementSKUs);
}

// 3. Update Tab Button Title in InventoryManagementView
const oldTabBtn = `<span>Theo Dõi Mực In 12 Màu ({inkImports.length})</span>`;
const newTabBtn = `<span>Theo dõi và quản lý Giấy - Mực in</span>`;

if (code.includes(oldTabBtn)) {
  code = code.replace(oldTabBtn, newTabBtn);
}

fs.writeFileSync('src/components/InventoryManagementView.tsx', code, 'utf8');
console.log('Updated InventoryManagementView.tsx for paper materials successfully!');
