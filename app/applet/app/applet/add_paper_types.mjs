import fs from 'fs';

let code = fs.readFileSync('src/types/index.ts', 'utf8');

const paperTypeDecl = `
// =================================================================
// BẢNG GIÁ DANH MỤC GIẤY IN (GIẤY RC BÓNG, GIẤY PP KHỔ 51->111)
// =================================================================
export interface PaperMaterialItem {
  id: string;               // e.g. 'G-RC-51'
  sku: string;              // e.g. 'G-RC-51'
  name: string;             // e.g. 'Giấy RC bóng khổ 51'
  paperType: 'Giấy RC bóng' | 'Giấy PP';
  widthSize: number;        // 51, 61, 76, 91, 111
  unit: string;             // 'Cuộn' hoặc 'roll'
  price: number;            // Đơn giá VNĐ theo cuộn
  updatedAt: string;        // Ngày sửa giá gần nhất
  supplier?: string;        // 'SVP' hoặc 'Toản HN'
}

export type PaperMaterialMap = Record<string, PaperMaterialItem>;
`;

if (!code.includes('export interface PaperMaterialItem')) {
  const target = 'export type AccessoryMaterialMap = Record<string, AccessoryMaterialItem>;';
  code = code.replace(target, target + '\n' + paperTypeDecl);
  fs.writeFileSync('src/types/index.ts', code, 'utf8');
  console.log('Added PaperMaterialItem to src/types/index.ts');
} else {
  console.log('PaperMaterialItem already exists in src/types/index.ts');
}
