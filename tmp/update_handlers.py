import os

with open('src/components/InventoryManagementView.tsx', 'r') as f:
    code = f.read()

# Locate handleOpenManualInward
start_str = 'const handleOpenManualInward = (presetSupplier?: string) => {'
end_str = 'setIsNewImportModalOpen(false);\n  };'

if start_str in code and end_str in code:
    s_idx = code.find('// Open Manual Inward Modal')
    if s_idx == -1:
        s_idx = code.find(start_str)
    
    e_idx = code.find(end_str, s_idx) + len(end_str)

    new_handlers = '''  // Open Stock Import Modal (Tạo đơn nhập hàng mới)
  const handleOpenManualInward = (presetSupplier?: string) => {
    setEditingImportReceipt(null);
    setImportDate(new Date().toISOString().slice(0, 10));
    setImportSupplier(presetSupplier || '');
    setImportStatus('completed');
    setImportNotes('');
    setImportReceiptCode(`NK-194-${new Date().getFullYear()}-${(stockImports.length + 1).toString().padStart(3, '0')}`);
    setImportItemsList([
      {
        id: `ii-${Date.now()}-0`,
        materialId: '',
        materialCode: '',
        materialName: '',
        unit: 'Tấm',
        quantity: 1,
        costPrice: 0,
        totalCost: 0
      }
    ]);
    setIsNewImportModalOpen(true);
  };

  const handleOpenEditImport = (receipt: StockImportReceipt) => {
    setEditingImportReceipt(receipt);
    setImportDate(receipt.date);
    setImportSupplier(receipt.supplier);
    setImportStatus(receipt.status || 'completed');
    setImportNotes(receipt.notes || '');
    setImportReceiptCode(receipt.receiptNumber);

    if (receipt.items && receipt.items.length > 0) {
      setImportItemsList(receipt.items.map(it => ({
        id: it.id || `ii-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        materialId: it.materialId || '',
        materialCode: it.materialCode || '',
        materialName: it.materialName || '',
        unit: it.unit || 'Tấm',
        quantity: it.quantity || 1,
        costPrice: it.costPrice || 0,
        totalCost: it.totalCost || ((it.quantity || 1) * (it.costPrice || 0))
      })));
    } else {
      setImportItemsList([
        {
          id: `ii-${Date.now()}-0`,
          materialId: '',
          materialCode: '',
          materialName: '',
          unit: 'Tấm',
          quantity: 1,
          costPrice: 0,
          totalCost: 0
        }
      ]);
    }
    setIsNewImportModalOpen(true);
  };

  // Helper actions for item list in import modal
  const handleSelectSKUInRow = (idx: number, skuCodeOrId: string) => {
    const sku = availableSKUsList.find(s => s.id === skuCodeOrId || s.code.toUpperCase() === skuCodeOrId.toUpperCase());
    if (!sku) return;

    setImportItemsList(prev => {
      const updated = [...prev];
      const q = updated[idx].quantity || 1;
      const cp = sku.price || updated[idx].costPrice || 0;
      updated[idx] = {
        ...updated[idx],
        materialId: sku.id,
        materialCode: sku.code,
        materialName: sku.name,
        unit: sku.unit || 'Tấm',
        costPrice: cp,
        totalCost: q * cp
      };
      return updated;
    });
  };

  const handleAddItemRow = () => {
    setImportItemsList(prev => [
      ...prev,
      {
        id: `ii-${Date.now()}-${prev.length}`,
        materialId: '',
        materialCode: '',
        materialName: '',
        unit: 'Tấm',
        quantity: 1,
        costPrice: 0,
        totalCost: 0
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (importItemsList.length <= 1) return;
    setImportItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateRowField = (idx: number, field: 'quantity' | 'costPrice' | 'materialName' | 'materialCode' | 'unit', val: any) => {
    setImportItemsList(prev => {
      const updated = [...prev];
      const cur = { ...updated[idx], [field]: val };
      const q = Number(cur.quantity) || 0;
      const cp = Number(cur.costPrice) || 0;
      cur.totalCost = q * cp;
      updated[idx] = cur;
      return updated;
    });
  };

  const handleQuickUpdateStatus = (receipt: StockImportReceipt, newStatus: 'pending' | 'ordered' | 'completed') => {
    const updatedReceipt: StockImportReceipt = {
      ...receipt,
      status: newStatus
    };
    onSaveStockImport(updatedReceipt);
  };

  const handleSaveManualInwardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importSupplier.trim()) {
      alert('Vui lòng chọn hoặc nhập tên nhà cung cấp!');
      return;
    }

    const validItems: StockImportItem[] = importItemsList
      .filter(it => it.materialName.trim() || it.materialCode.trim())
      .map((it, idx) => {
        const q = Number(it.quantity) || 1;
        const cp = Number(it.costPrice) || 0;
        const tc = it.totalCost || (q * cp);
        return {
          id: it.id || `ii-${Date.now()}-${idx}`,
          materialId: it.materialId || `mat-${Date.now()}-${idx}`,
          materialCode: it.materialCode.trim() || `VT-${Date.now()}`,
          materialName: it.materialName.trim() || 'Vật tư nhập',
          unit: it.unit.trim() || 'Cái',
          quantity: q,
          costPrice: cp,
          totalCost: tc
        };
      });

    if (validItems.length === 0) {
      alert('Vui lòng chọn hoặc nhập ít nhất 1 sản phẩm/vật tư nhập!');
      return;
    }

    const totalOrderAmount = validItems.reduce((sum, it) => sum + it.totalCost, 0);

    const receiptId = editingImportReceipt ? editingImportReceipt.id : `imp-${Date.now()}`;
    const code = importReceiptCode.trim() || `NK-194-${new Date().getFullYear()}-${(stockImports.length + 1).toString().padStart(3, '0')}`;

    const newReceipt: StockImportReceipt = {
      id: receiptId,
      receiptNumber: code,
      date: importDate,
      supplier: importSupplier.trim(),
      items: validItems,
      totalAmount: totalOrderAmount,
      paid: totalOrderAmount,
      status: importStatus,
      notes: importNotes.trim() || '',
      createdAt: editingImportReceipt ? editingImportReceipt.createdAt : new Date().toISOString()
    };

    onSaveStockImport(newReceipt);
    setIsNewImportModalOpen(false);
  };'''

    code = code[:s_idx] + new_handlers + code[e_idx:]
    with open('src/components/InventoryManagementView.tsx', 'w') as f:
        f.write(code)
    print('Updated handlers in InventoryManagementView.tsx successfully!')
else:
    print('Indices not found!')
