import React, { useState, useMemo } from 'react';
import {
  FileText,
  Truck,
  Plus,
  Search,
  Printer,
  Download,
  MessageCircle,
  CheckCircle2,
  Trash2,
  PackagePlus,
} from 'lucide-react';
import {
  CommercialDocument,
  ProductItem,
  SupplierItem,
  SystemRoleType,
} from '../types/ferreteria.ts';
import {
  VoucherActionModal,
  VoucherDocumentData,
  addDaysToTodayIso,
  formatIsoToAr,
  getTodayIso,
} from './OrdersModule.tsx';
import { StatusBadge } from './StatusBadge.tsx';

interface PurchasesInvoicesSubViewProps {
  mode: 'facturacion' | 'compras';
  documents: CommercialDocument[];
  products: ProductItem[];
  suppliers: SupplierItem[];
  branchName: string;
  sellerName: string;
  activeSystemRole: SystemRoleType;
  formatCurrency: (val: string | number) => string;
  onProductsAndSuppliersUpdated: (
    nextProducts: ProductItem[],
    nextSuppliers: SupplierItem[],
    msg?: string
  ) => void;
  onCycleDocStatus?: (doc: CommercialDocument) => void;
}

interface PurchaseLineItem {
  productId: number;
  sku: string;
  name: string;
  currentStock: number;
  quantity: number;
  unitCost: number;
}

interface PurchaseHistoryEntry {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  date: string;
  supplierName: string;
  itemsCount: number;
  totalAmount: number;
  items: PurchaseLineItem[];
}

export const PURCHASE_HISTORY_KEY =
  'ferreteria_del_puente_purchase_invoices_v2_clean';

function loadPurchaseHistory(_suppliers: SupplierItem[]): PurchaseHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PURCHASE_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export const PurchasesInvoicesSubView: React.FC<PurchasesInvoicesSubViewProps> = ({
  mode,
  documents,
  products,
  suppliers,
  branchName,
  sellerName,
  formatCurrency,
  onProductsAndSuppliersUpdated,
  onCycleDocStatus,
}) => {
  // Facturación state
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('Todos');
  const [activeVoucherModal, setActiveVoucherModal] = useState<{
    voucher: VoucherDocumentData;
    tab: 'pdf' | 'whatsapp';
  } | null>(null);

  // Compras / Recepción de Facturas de Compra state
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryEntry[]>(
    () => loadPurchaseHistory(suppliers)
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.id ? String(suppliers[0].id) : ''
  );
  const [invoiceNumber, setInvoiceNumber] = useState('FC-A-0005-00089412');
  const [invoiceType, setInvoiceType] = useState('Factura A Proveedor');
  const [addToSupplierBalance, setAddToSupplierBalance] = useState(true);
  const [updateProductCosts, setUpdateProductCosts] = useState(true);
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLineItem[]>([]);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  const invoiceDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return documents.filter((d) => {
      if (docTypeFilter !== 'Todos' && d.docType !== docTypeFilter) return false;
      if (!q) return true;
      return (
        d.docNumber.toLowerCase().includes(q) ||
        d.clientName.toLowerCase().includes(q) ||
        d.clientCuit.toLowerCase().includes(q) ||
        d.docType.toLowerCase().includes(q)
      );
    });
  }, [documents, docSearch, docTypeFilter]);

  const matchingPurchaseProducts = useMemo(() => {
    const q = prodSearchQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, prodSearchQuery]);

  const purchaseTotal = useMemo(
    () =>
      purchaseLines.reduce(
        (acc, l) => acc + Math.max(1, l.quantity) * Math.max(0, l.unitCost),
        0
      ),
    [purchaseLines]
  );

  const handleAddProductToPurchase = (prod: ProductItem) => {
    setPurchaseLines((prev) => {
      const existing = prev.find((l) => l.productId === prod.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === prod.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          currentStock: prod.stock,
          quantity: 6,
          unitCost: parseFloat(prod.costPrice) || 0,
        },
      ];
    });
  };

  const handleConfirmPurchaseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseLines.length === 0) return;

    setIsSubmittingPurchase(true);
    try {
      const res = await fetch('/api/purchases/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId ? Number(selectedSupplierId) : null,
          invoiceNumber: invoiceNumber.trim() || 'FC-PROV-S/N',
          invoiceType,
          addToSupplierBalance,
          updateProductCosts,
          items: purchaseLines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar factura de compra');
      }

      const supObj = suppliers.find(
        (s) => String(s.id) === String(selectedSupplierId)
      );
      const totalUnits = purchaseLines.reduce((acc, l) => acc + l.quantity, 0);
      const newEntry: PurchaseHistoryEntry = {
        id: `FC-COMP-${Date.now()}`,
        invoiceNumber: invoiceNumber.trim() || 'FC-PROV-S/N',
        invoiceType,
        date: formatIsoToAr(getTodayIso()),
        supplierName: supObj?.name || 'Proveedor General',
        itemsCount: totalUnits,
        totalAmount: purchaseTotal,
        items: purchaseLines,
      };
      const nextHistory = [newEntry, ...purchaseHistory];
      setPurchaseHistory(nextHistory);
      try {
        window.localStorage.setItem(
          PURCHASE_HISTORY_KEY,
          JSON.stringify(nextHistory)
        );
      } catch {
        // ignore
      }

      setPurchaseLines([]);
      setInvoiceNumber(
        `FC-A-0005-000${Math.floor(10000 + Math.random() * 89999)}`
      );
      onProductsAndSuppliersUpdated(
        data.products || products,
        data.suppliers || suppliers,
        `Factura de Compra ${newEntry.invoiceNumber} confirmada: +${totalUnits} u. sumadas automáticamente al inventario.`
      );
    } catch (err: any) {
      onProductsAndSuppliersUpdated(
        products,
        suppliers,
        err.message || 'No se pudo registrar la compra'
      );
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  const buildVoucherFromDoc = (doc: CommercialDocument): VoucherDocumentData => {
    const sampleItems = products.slice(0, Math.min(3, Math.max(1, doc.itemsCount)));
    const totalVal = parseFloat(doc.totalAmount) || 0;
    return {
      docNumber: doc.docNumber,
      docType: doc.docType,
      dateFormatted: formatIsoToAr(getTodayIso()),
      dueDateFormatted: formatIsoToAr(addDaysToTodayIso(15)),
      issueDate: formatIsoToAr(getTodayIso()),
      validUntilDate: formatIsoToAr(addDaysToTodayIso(15)),
      recipientRoleLabel: 'Cliente / Razón Social',
      partyLabel: 'Cliente / Razón Social',
      partyName: doc.clientName,
      partyCuit: doc.clientCuit,
      partyPhone: '',
      supplierName: doc.clientName,
      supplierCuit: doc.clientCuit,
      supplierPhone: '',
      branchName: doc.branchName || branchName,
      operatorName: doc.sellerName || sellerName,
      status: doc.status,
      statusLabel: doc.status,
      notes: 'Comprobante comercial emitido desde sistema central.',
      items: sampleItems.map((p, idx) => ({
        sku: p.sku,
        name: p.name,
        description: p.name,
        quantity: idx === 0 ? Math.max(1, doc.itemsCount) : 1,
        unitCost: idx === 0 ? totalVal / Math.max(1, doc.itemsCount) : 0,
        unitPrice: idx === 0 ? totalVal / Math.max(1, doc.itemsCount) : 0,
        subtotal: idx === 0 ? totalVal : 0,
      })),
      totalAmount: totalVal,
    };
  };

  if (mode === 'facturacion') {
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#FF6600]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Registro e Historial Completo de Comprobantes y Facturas Emitidas
              </h2>
              <p className="text-xs text-slate-500">
                Auditoría de Facturas A, Facturas B, Tickets Fiscales, Remitos y Presupuestos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['Todos', 'Factura A', 'Factura B', 'Presupuesto', 'Remito'].map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDocTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    docTypeFilter === t
                      ? 'bg-[#FF6600] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              )
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Buscar por Nro. comprobante, cliente o CUIT..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
              />
            </div>
            <span className="text-xs font-mono text-slate-500">
              Total registros: <strong>{invoiceDocuments.length}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Nro. Comprobante</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-4">Sucursal / Vendedor</th>
                  <th className="py-3 px-4 text-right">Ítems</th>
                  <th className="py-3 px-4 text-right">Importe Total</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Imprimir / WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {invoiceDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {doc.docNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">
                      {doc.docType}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {doc.clientName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        CUIT {doc.clientCuit}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div>{doc.branchName}</div>
                      <div className="text-[11px] text-slate-400">
                        Op: {doc.sellerName}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {doc.itemsCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(doc.totalAmount)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge
                        status={doc.status}
                        onClick={() => onCycleDocStatus && onCycleDocStatus(doc)}
                      />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVoucherModal({
                              voucher: buildVoucherFromDoc(doc),
                              tab: 'pdf',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Ticket / PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVoucherModal({
                              voucher: buildVoucherFromDoc(doc),
                              tab: 'whatsapp',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {activeVoucherModal && (
          <VoucherActionModal
            voucher={activeVoucherModal.voucher}
            initialTab={activeVoucherModal.tab}
            onClose={() => setActiveVoucherModal(null)}
            formatCurrency={formatCurrency}
          />
        )}
      </div>
    );
  }

  // mode === 'compras' (Recepción de Pedidos / Compras a Proveedores)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Formulario para registrar facturas de compra */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Recepción de Pedidos / Facturas de Compra a Proveedores
                </h2>
                <p className="text-xs text-slate-500">
                  Al confirmar la factura, el sistema incrementa automáticamente el stock en el inventario
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleConfirmPurchaseInvoice} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proveedor Emisor
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (CUIT {s.cuit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Comprobante
                </label>
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Factura A Proveedor">Factura A Proveedor</option>
                  <option value="Factura B / C Proveedor">Factura B / C Proveedor</option>
                  <option value="Remito de Recepción Oficial">Remito de Recepción Oficial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nro. Factura / Remito
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FC-A-0005-00089412"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>

            {/* Buscador de artículos para agregar a la recepción */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Buscar Producto por Código / SKU o Nombre para Ingresar Stock
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={prodSearchQuery}
                  onChange={(e) => setProdSearchQuery(e.target.value)}
                  placeholder="Escanee código o escriba nombre del artículo recibido..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                {matchingPurchaseProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddProductToPurchase(prod)}
                    className="p-2.5 rounded-lg bg-white hover:bg-orange-50/70 border border-slate-200 hover:border-[#FF6600] text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {prod.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {prod.sku} · Stock actual: <strong>{prod.stock} u.</strong>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded bg-[#FF6600] text-white text-[11px] font-bold shrink-0">
                      + Agregar
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabla de renglones de la factura de compra */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-3">Código / Producto</th>
                    <th className="py-2.5 px-3 text-right">Stock Actual</th>
                    <th className="py-2.5 px-3 text-right">Cant. Recibida (+)</th>
                    <th className="py-2.5 px-3 text-right">Costo Unit. ($)</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {purchaseLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Seleccione productos arriba para registrar el ingreso de mercadería y sumar al stock.
                      </td>
                    </tr>
                  ) : (
                    purchaseLines.map((line) => (
                      <tr key={line.productId}>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {line.name}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {line.sku}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {line.currentStock} u. →{' '}
                          <strong className="text-emerald-700">
                            {line.currentStock + line.quantity} u.
                          </strong>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setPurchaseLines((prev) =>
                                prev.map((l) =>
                                  l.productId === line.productId
                                    ? { ...l, quantity: val }
                                    : l
                                )
                              );
                            }}
                            className="w-20 px-2 py-1 text-right font-mono font-bold border border-slate-300 rounded bg-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unitCost}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setPurchaseLines((prev) =>
                                prev.map((l) =>
                                  l.productId === line.productId
                                    ? { ...l, unitCost: val }
                                    : l
                                )
                              );
                            }}
                            className="w-28 px-2 py-1 text-right font-mono border border-slate-300 rounded bg-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(line.quantity * line.unitCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setPurchaseLines((prev) =>
                                prev.filter((l) => l.productId !== line.productId)
                              )
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="space-y-1.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={updateProductCosts}
                    onChange={(e) => setUpdateProductCosts(e.target.checked)}
                    className="rounded border-slate-300 text-[#FF6600] focus:ring-[#FF6600]"
                  />
                  <span>Actualizar costo y recalcular precio de venta de los ítems recibidos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={addToSupplierBalance}
                    onChange={(e) => setAddToSupplierBalance(e.target.checked)}
                    className="rounded border-slate-300 text-[#FF6600] focus:ring-[#FF6600]"
                  />
                  <span>Imputar factura en la Cuenta Corriente del Proveedor</span>
                </label>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-500">Total Factura Compra</div>
                <div className="text-xl font-bold font-mono text-[#FF6600]">
                  {formatCurrency(purchaseTotal)}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={purchaseLines.length === 0 || isSubmittingPurchase}
              className="w-full py-3 px-4 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmittingPurchase
                  ? 'Procesando Recepción y Stock...'
                  : 'Confirmar Factura de Compra e Incrementar Stock Automáticamente'}
              </span>
            </button>
          </form>
        </div>

        {/* Right: Historial de Facturas de Compra Recepcionadas */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
            <Truck className="w-5 h-5 text-[#FF6600]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Historial de Compras y Recepciones Confirmadas
              </h3>
              <p className="text-xs text-slate-500">
                Comprobantes de proveedores que impactaron stock
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto">
            {purchaseHistory.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-900">
                    {entry.invoiceNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    +{entry.itemsCount} u. ingresadas
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  {entry.supplierName}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>
                    {entry.invoiceType} · {entry.date}
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(entry.totalAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
