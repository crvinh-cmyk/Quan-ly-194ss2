with open('src/components/CustomerManagementView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update studioName check & freelance/walkin note
old_block = '''                    {cust.studioName && (
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">
                        {cust.studioName}
                      </span>
                    )}

                    {/* Ghi chú tệp khách vãng lai (CHỈ cho đúng 2 tệp gom chung của hệ thống, KHÔNG áp dụng cho khách cố định như Phước Công) */}
                    {isWalkInPoolCustomer(cust) ? (
                      <div className="mt-2 p-2 rounded-xl bg-amber-50/70 border border-amber-200/90 text-[11px] text-amber-950">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Tệp khách vãng lai (không tạo khách mới)</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                          💡 Mỗi đơn ghi tên riêng từng người (VD: Anh Tuấn, Chị Mai). Sổ nợ & hóa đơn nội bộ hiện rõ tên riêng, khi chụp gửi khách tự động ẩn 2 từ "{cust.name}".
                        </p>
                      </div>
                    ) : cust.customerType === 'Freelance' ? (
                      <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-amber-50/50 border border-amber-200/70 text-[11px] text-amber-900 flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1">
                          <Camera className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Khách Freelance Cố Định</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Bảng giá: Freelance</span>
                      </div>
                    ) : null}'''

new_block = '''                    {/* Chỉ hiện tên Studio/thương hiệu phụ nếu KHÁC tên chính và không phải tệp vãng lai (tránh lặp 2 chữ Freelance) */}
                    {cust.studioName && cust.studioName.trim().toLowerCase() !== cust.name.trim().toLowerCase() && !isWalkInPoolCustomer(cust) && (
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">
                        {cust.studioName}
                      </span>
                    )}

                    {/* Phân biệt rõ ràng: Tệp khách vãng lai gom chung VS Khách Freelance cố định */}
                    {isWalkInPoolCustomer(cust) ? (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-[11px] text-amber-950">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Tệp khách vãng lai (không tạo khách mới)</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                          💡 Dành cho khách {cust.customerType === 'Freelance' ? 'thợ tự do' : 'khách lẻ'} ghé tiệm 1-2 lần. Khi lập đơn ghi tên riêng từng người (VD: Anh Tuấn, Chị Mai...). Sổ nợ & thống kê nội bộ gom vào tệp này, khi chụp gửi khách tự động ẩn chữ "{cust.name}".
                        </p>
                      </div>
                    ) : cust.customerType === 'Freelance' ? (
                      <div className="mt-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50/70 border border-purple-200 text-[11px] text-purple-950 flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1.5 text-purple-900">
                          <Camera className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>Khách Freelance Cố Định</span>
                        </span>
                        <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded-md">
                          Bảng giá: Freelance
                        </span>
                      </div>
                    ) : null}'''

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    print("1. Replaced studioName and notes block")
else:
    print("1. NOT FOUND old_block")

# 2. Delete button on all cards
old_del_btn = '''                  {!isWalkInPoolCustomer(cust) && onDeleteCustomer && (
                    <>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setCustomerToDelete(cust)}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-0.5 transition"
                        title={`Xóa khách hàng ${cust.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Xóa</span>
                      </button>
                    </>
                  )}'''

new_del_btn = '''                  {onDeleteCustomer && (
                    <>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setCustomerToDelete(cust)}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-0.5 transition"
                        title={`Xóa khách hàng ${cust.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Xóa</span>
                      </button>
                    </>
                  )}'''

if old_del_btn in content:
    content = content.replace(old_del_btn, new_del_btn, 1)
    print("2. Replaced card delete button")
else:
    print("2. NOT FOUND old_del_btn")

# 3. Delete button in edit modal
old_modal_del = '''              {editingCust && !isWalkInPoolCustomer(editingCust) && onDeleteCustomer ? (
                <button
                  type="button"
                  onClick={() => {
                    const toDel = editingCust;
                    setIsCustomerModalOpen(false);
                    setCustomerToDelete(toDel);
                  }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer flex items-center gap-1 font-semibold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa khách hàng</span>
                </button>
              ) : <div />}'''

new_modal_del = '''              {editingCust && onDeleteCustomer ? (
                <button
                  type="button"
                  onClick={() => {
                    const toDel = editingCust;
                    setIsCustomerModalOpen(false);
                    setCustomerToDelete(toDel);
                  }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer flex items-center gap-1 font-semibold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa khách hàng</span>
                </button>
              ) : <div />}'''

if old_modal_del in content:
    content = content.replace(old_modal_del, new_modal_del, 1)
    print("3. Replaced modal delete button")
else:
    print("3. NOT FOUND old_modal_del")

# 4. Modal customerType options
old_modal_type = '''                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-amber-50/40 outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="GIÁ STUDIO">🏢 1. GIÁ STUDIO (Studio áo cưới & Đại lý sỉ)</option>
                  <option value="Freelance">📸 2. Freelance (Thợ chụp ảnh tự do & Quay phim)</option>
                  <option value="Khách Lẻ">👤 3. Khách Lẻ (Khách lẻ in gia đình & Tiệc)</option>
                </select>'''

new_modal_type = '''                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-amber-50/40 outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="GIÁ STUDIO">🏢 1. GIÁ STUDIO (Studio áo cưới & Đại lý sỉ)</option>
                  <option value="Freelance">📸 2. Freelance Cố Định (Thợ chụp ảnh tự do - Dùng Bảng giá Freelance)</option>
                  <option value="Khách Lẻ">👤 3. Khách Lẻ Cố Định (Khách quen in thường xuyên - Dùng Bảng giá Khách Lẻ)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  💡 <strong>Lưu ý:</strong> Tệp khách <em>Freelance vãng lai</em> và <em>Khách lẻ vãng lai</em> ghé 1-2 lần đã có sẵn trên hệ thống (không cần tạo mới tại đây). Mục này dùng để tạo khách Freelance cố định (như <em>Phước Công</em>) hoặc Studio có hồ sơ và công nợ riêng.
                </p>'''

if old_modal_type in content:
    content = content.replace(old_modal_type, new_modal_type, 1)
    print("4. Replaced modal customerType options")
else:
    print("4. NOT FOUND old_modal_type")

# 5. Delete confirmation modal details
old_confirm = '''            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                Bạn có chắc chắn muốn xóa khách hàng{' '}
                <strong className="text-slate-900 text-sm font-bold">{customerToDelete.name}</strong>
                {customerToDelete.studioName ? ` (${customerToDelete.studioName})` : ''} khỏi danh sách khách hàng không?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  💡 <strong>Lưu ý:</strong> Dữ liệu các hóa đơn cũ đã tạo trước đây của khách này vẫn được bảo toàn an toàn trong hệ thống và sổ doanh thu.
                </p>
              </div>
            </div>'''

new_confirm = '''            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                Bạn có chắc chắn muốn xóa khách hàng{' '}
                <strong className="text-slate-900 text-sm font-bold">{customerToDelete.name}</strong>
                {customerToDelete.studioName ? ` (${customerToDelete.studioName})` : ''} khỏi danh sách khách hàng và sổ nợ không?
              </p>
              {isWalkInPoolCustomer(customerToDelete) ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    ⚠️ <strong>Lưu ý:</strong> Đây là mục tệp khách vãng lai gom chung của xưởng. Nếu xóa, bạn vẫn có thể thêm lại hoặc nhập tên khách lẻ/freelance trực tiếp khi lên đơn bất cứ lúc nào.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    💡 <strong>Lưu ý:</strong> Dữ liệu các hóa đơn cũ đã tạo trước đây của khách này vẫn được bảo toàn an toàn trong hệ thống và sổ doanh thu.
                  </p>
                </div>
              )}
            </div>'''

if old_confirm in content:
    content = content.replace(old_confirm, new_confirm, 1)
    print("5. Replaced delete confirmation modal")
else:
    print("5. NOT FOUND old_confirm")

with open('src/components/CustomerManagementView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("All updates applied to CustomerManagementView.tsx!")
