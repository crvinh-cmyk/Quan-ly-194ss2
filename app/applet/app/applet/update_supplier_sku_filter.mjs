import fs from 'fs';

let code = fs.readFileSync('src/components/InventoryManagementView.tsx', 'utf8');

// 1. Add INK_12_COLORS import if not present
if (!code.includes('INK_12_COLORS')) {
  code = "import { INK_12_COLORS } from '../data/initialData';\n" + code;
}

// 2. Add filteredSKUsForSupplier right after availableSKUsList
const availableSKUsEndTarget = "    return skus;\n  }, [materials]);";

const filteredSKUsCode = `    return skus;
  }, [materials]);

  // Dynamically filter SKUs based on selected Supplier (SVP vs Non-SVP)
  const filteredSKUsForSupplier = useMemo(() => {
    const supplierUpper = (importSupplier || '').trim().toUpperCase();
    const isSVP = supplierUpper === 'SVP';

    if (isSVP) {
      // SVP Supplier: ONLY show Paper (Giấy in) and Ink (Mực in) items!
      const inkAndPaperSKUs = availableSKUsList.filter(s => {
        const cat = (s.category || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        const code = (s.code || '').toLowerCase();

        const isPaper = cat.includes('giấy') || name.includes('giấy') || code.startsWith('g-rc-') || code.startsWith('g-pp-');
        const isInk = cat.includes('mực') || name.includes('mực') || name.includes('lucia') || code.includes('muc');

        return isPaper || isInk;
      });

      // Include the 12 Lucia Pro Ink Bottles if not already listed
      INK_12_COLORS.forEach(c => {
        const code = \`MUC-LUCIA-\${c.code}\`;
        if (!inkAndPaperSKUs.some(s => s.code.toUpperCase() === code.toUpperCase() || s.name.includes(\`Bình mực \${c.code}\`))) {
          inkAndPaperSKUs.push({
            id: \`ink-\${c.code}\`,
            code: code,
            name: \`Bình Mực Canon Lucia Pro \${c.code} (\${c.vietnameseName})\`,
            unit: 'Bình',
            price: 880000,
            category: 'Mực In 12 Màu (SVP)',
            source: 'inventory' as const
          });
        }
      });

      return inkAndPaperSKUs;
    } else {
      // Non-SVP Suppliers (Trang Phóng, Ninh Trang, Toản HN, Xuân Trường HN, Tuấn Tú Vinh, Khác...):
      // ONLY show general warehouse materials (Ván, Fomex, Mica, Phào, Nẹp, Khung, Phụ kiện...)
      // EXCLUDE Paper and Ink!
      return availableSKUsList.filter(s => {
        const cat = (s.category || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        const code = (s.code || '').toLowerCase();

        const isPaper = cat.includes('giấy') || name.includes('giấy') || code.startsWith('g-rc-') || code.startsWith('g-pp-');
        const isInk = cat.includes('mực') || name.includes('mực') || name.includes('lucia') || code.includes('muc');

        return !isPaper && !isInk;
      });
    }
  }, [importSupplier, availableSKUsList]);`;

if (!code.includes('filteredSKUsForSupplier')) {
  code = code.replace(availableSKUsEndTarget, filteredSKUsCode);
}

// 3. Update handleSelectSKUInRow to use filteredSKUsForSupplier
code = code.replace(
  'const sku = availableSKUsList.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase());',
  'const sku = filteredSKUsForSupplier.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase()) || availableSKUsList.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase());'
);

// 4. Update Modal 2 SKU Dropdown to map filteredSKUsForSupplier & add filtering badge
const oldSelectCode = `{availableSKUsList.map(sku => (
                                <option key={sku.id} value={sku.id}>
                                  [{sku.code}] {sku.name} ({sku.category})
                                </option>
                              ))}`;

const newSelectCode = `{filteredSKUsForSupplier.map(sku => (
                                <option key={sku.id} value={sku.id}>
                                  [{sku.code}] {sku.name} ({sku.category})
                                </option>
                              ))}`;

if (code.includes(oldSelectCode)) {
  code = code.replace(oldSelectCode, newSelectCode);
}

// Add Supplier Filter Badge above Multi-Item Table Section
const itemTableHeading = `<label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                    DANH SÁCH SẢN PHẨM / VẬT TƯ NHẬP ({importItemsList.length} mặt hàng)
                  </label>`;

const newTableHeading = `<div className="flex items-center gap-2 flex-wrap">
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                      DANH SÁCH SẢN PHẨM / VẬT TƯ NHẬP ({importItemsList.length} mặt hàng)
                    </label>
                    <span className={\`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border \${
                      (importSupplier || '').trim().toUpperCase() === 'SVP'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }\`}>
                      {(importSupplier || '').trim().toUpperCase() === 'SVP'
                        ? \`📦 NCC SVP: Tự động lọc chỉ hiển thị Giấy In & Mực In (\${filteredSKUsForSupplier.length} SKU)\`
                        : \`📦 NCC \${importSupplier || 'Khác'}: Tự động lọc chỉ hiển thị Ván, Fomex, Mica, Phào, Khung, Phụ kiện (\${filteredSKUsForSupplier.length} SKU)\`}
                    </span>
                  </div>`;

if (code.includes(itemTableHeading) && !code.includes('Tự động lọc chỉ hiển thị')) {
  code = code.replace(itemTableHeading, newTableHeading);
}

fs.writeFileSync('src/components/InventoryManagementView.tsx', code, 'utf8');
console.log('Updated supplier SKU filter in InventoryManagementView.tsx successfully!');
