import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Package,
  Truck,
  Users,
  Download,
  Upload,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Columns3,
  Plus,
  X,
  ArrowUpDown,
  Percent,
  DollarSign,
  Boxes,
  Save,
  RotateCcw,
  Eye,
  CheckCircle2,
  Calculator,
  Tag,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { ProductItem, SupplierItem } from '../types/ferreteria.ts';
import {
  calculateUnitFractionalCost,
  saveProductExtendedMeta,
  enrichProductWithExtendedMeta,
  loadProductExtendedMetaMap,
} from './ProductsModule.tsx';
import {
  downloadBaseEntityTemplate,
  ImportEntityMode,
} from './BulkImportModal.tsx';

export type EditableColumnKey =
  | 'sku'
  | 'name'
  | 'purchaseUnit'
  | 'unitsPerPackage'
  | 'costPrice'
  | 'unitFractionalCost'
  | 'salePrice'
  | 'cardPrice'
  | 'stock'
  | 'category'
  | 'brand'
  | 'supplierName';

interface ColumnMeta {
  key: EditableColumnKey;
  label: string;
  shortLabel: string;
  align?: 'left' | 'right' | 'center';
}

const ALL_COLUMNS: ColumnMeta[] = [
  { key: 'sku', label: 'Código / SKU', shortLabel: 'SKU', align: 'left' },
  { key: 'name', label: 'Nombre del Producto', shortLabel: 'Nombre', align: 'left' },
  {
    key: 'purchaseUnit',
    label: 'Tipo Empaque',
    shortLabel: 'Tipo Empaque',
    align: 'left',
  },
  {
    key: 'unitsPerPackage',
    label: 'Unidades x Bulto',
    shortLabel: 'Unid. x Bulto',
    align: 'right',
  },
  {
    key: 'costPrice',
    label: 'Costo Bulto ($)',
    shortLabel: 'Costo Bulto',
    align: 'right',
  },
  {
    key: 'unitFractionalCost',
    label: 'Costo Unitario ($ Bulto / Unid.)',
    shortLabel: 'Costo Unitario',
    align: 'right',
  },
  {
    key: 'salePrice',
    label: 'Precio Efectivo Unidad ($)',
    shortLabel: 'Precio Efectivo',
    align: 'right',
  },
  {
    key: 'cardPrice',
    label: 'Precio Tarjeta Unidad ($)',
    shortLabel: 'Precio Tarjeta',
    align: 'right',
  },
  { key: 'stock', label: 'Stock Actual', shortLabel: 'Stock', align: 'right' },
  { key: 'category', label: 'Categoría', shortLabel: 'Categoría', align: 'left' },
  { key: 'brand', label: 'Marca', shortLabel: 'Marca', align: 'left' },
  { key: 'supplierName', label: 'Proveedor', shortLabel: 'Proveedor', align: 'left' },
];

const PACKAGE_TYPE_OPTIONS = [
  'CAJA',
  'ROLLO',
  'PAQUETE',
  'BULTO',
  'PALLET',
  'BOLSA',
  'BALDE',
  'PACK',
  'BOBINA',
  'UNIDAD',
];

export type StockLevelFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
export type SortFieldOption = 'name' | 'sku';
export type SortDirectionOption = 'asc' | 'desc';

interface DraftProductRow {
  id: number;
  sku: string;
  name: string;
  purchaseUnit: string;
  unitsPerPackage: number;
  costPrice: number;
  unitFractionalCost: number;
  salePrice: number;
  cardPrice: number;
  stock: number;
  minStock: number;
  category: string;
  brand: string;
  supplierName: string;
}

interface BulkProductEditorModuleProps {
  products: ProductItem[];
  suppliers: SupplierItem[];
  formatCurrency: (val: string | number) => string;
  onProductsUpdated: (nextProducts: ProductItem[], message?: string) => void;
  onOpenImportModal: (mode: ImportEntityMode) => void;
}

export const BulkProductEditorModule: React.FC<BulkProductEditorModuleProps> = ({
  products,
  suppliers,
  formatCurrency,
  onProductsUpdated,
  onOpenImportModal,
}) => {
  // Mapa de filas editables en borrador (sincronizado con products)
  const [draftMap, setDraftMap] = useState<Record<number, DraftProductRow>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Filtros Avanzados en la Cabecera
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [stockLevelFilter, setStockLevelFilter] =
    useState<StockLevelFilter>('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortField, setSortField] = useState<SortFieldOption>('name');
  const [sortDir, setSortDir] = useState<SortDirectionOption>('asc');

  // Personalización Dinámica de Columnas (Mostrar / Ocultar / Agregar / Eliminar)
  const [visibleColumns, setVisibleColumns] = useState<EditableColumnKey[]>(
    ALL_COLUMNS.map((c) => c.key)
  );
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  // Pestaña activa de la Barra de Modificaciones Masivas
  const [activeBatchTab, setActiveBatchTab] = useState<
    'packaging' | 'prices' | 'stock' | 'assign'
  >('packaging');

  // Estado a) Configuración Masiva de Empaque / Bulto
  const [batchPackageType, setBatchPackageType] = useState<string>('CAJA');
  const [batchUnitsPerPackage, setBatchUnitsPerPackage] = useState<string>('10');
  const [batchBulkCostOptional, setBatchBulkCostOptional] = useState<string>('');
  const [batchRecalcSaleFromUnitCost, setBatchRecalcSaleFromUnitCost] =
    useState<boolean>(false);

  // Estado b) Ajuste Masivo de Precios
  const [priceOperation, setPriceOperation] = useState<'increase' | 'decrease'>(
    'increase'
  );
  const [priceMode, setPriceMode] = useState<'percent' | 'fixed'>('percent');
  const [priceTarget, setPriceTarget] = useState<
    'all' | 'costPrice' | 'salePrice' | 'cardPrice'
  >('all');
  const [priceValue, setPriceValue] = useState<string>('10');

  // Estado c) Ajuste Masivo de Stock
  const [stockOperation, setStockOperation] = useState<'add' | 'subtract' | 'set'>(
    'add'
  );
  const [stockValue, setStockValue] = useState<string>('10');

  // Estado d) Asignar Masivamente (Proveedor, Categoría o Marca)
  const [assignSupplier, setAssignSupplier] = useState<string>('');
  const [assignCategory, setAssignCategory] = useState<string>('');
  const [assignBrand, setAssignBrand] = useState<string>('');

  // Modal de Vista Previa antes de Guardar Cambios Masivos
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Inicializar borrador cuando cambian los productos base
  useEffect(() => {
    const nextDraft: Record<number, DraftProductRow> = {};
    products.forEach((rawProd) => {
      const p = enrichProductWithExtendedMeta(rawProd);
      const units =
        p.unitsPerPackage && p.unitsPerPackage > 0 ? p.unitsPerPackage : 1;
      const bulkCost = parseFloat(String(p.costPrice || '0')) || 0;
      const unitCost = calculateUnitFractionalCost(bulkCost, units);
      const cashSale = parseFloat(String(p.salePrice || '0')) || 0;
      const cardSale =
        p.cardPrice && Number.isFinite(parseFloat(String(p.cardPrice)))
          ? parseFloat(String(p.cardPrice))
          : Number((cashSale * 1.15).toFixed(2));

      nextDraft[p.id] = {
        id: p.id,
        sku: p.sku || '',
        name: p.name || '',
        purchaseUnit: (p.purchaseUnit || 'CAJA').toUpperCase(),
        unitsPerPackage: units,
        costPrice: Number(bulkCost.toFixed(2)),
        unitFractionalCost: Number(unitCost.toFixed(2)),
        salePrice: Number(cashSale.toFixed(2)),
        cardPrice: Number(cardSale.toFixed(2)),
        stock: Number(p.stock ?? 0),
        minStock: Number(p.minStock ?? 0),
        category: p.category || 'Ferretería General',
        brand: p.brand || 'Genérica',
        supplierName: p.supplierName || 'Proveedor General',
      };
    });
    setDraftMap(nextDraft);
  }, [products]);

  // Mapa original para detectar qué filas fueron modificadas
  const originalMap = useMemo(() => {
    const map: Record<number, DraftProductRow> = {};
    products.forEach((rawProd) => {
      const p = enrichProductWithExtendedMeta(rawProd);
      const units =
        p.unitsPerPackage && p.unitsPerPackage > 0 ? p.unitsPerPackage : 1;
      const bulkCost = parseFloat(String(p.costPrice || '0')) || 0;
      const unitCost = calculateUnitFractionalCost(bulkCost, units);
      const cashSale = parseFloat(String(p.salePrice || '0')) || 0;
      const cardSale =
        p.cardPrice && Number.isFinite(parseFloat(String(p.cardPrice)))
          ? parseFloat(String(p.cardPrice))
          : Number((cashSale * 1.15).toFixed(2));

      map[p.id] = {
        id: p.id,
        sku: p.sku || '',
        name: p.name || '',
        purchaseUnit: (p.purchaseUnit || 'CAJA').toUpperCase(),
        unitsPerPackage: units,
        costPrice: Number(bulkCost.toFixed(2)),
        unitFractionalCost: Number(unitCost.toFixed(2)),
        salePrice: Number(cashSale.toFixed(2)),
        cardPrice: Number(cardSale.toFixed(2)),
        stock: Number(p.stock ?? 0),
        minStock: Number(p.minStock ?? 0),
        category: p.category || 'Ferretería General',
        brand: p.brand || 'Genérica',
        supplierName: p.supplierName || 'Proveedor General',
      };
    });
    return map;
  }, [products]);

  const isRowModified = (id: number): boolean => {
    const orig = originalMap[id];
    const cur = draftMap[id];
    if (!orig || !cur) return false;
    return (
      orig.sku !== cur.sku ||
      orig.name !== cur.name ||
      orig.purchaseUnit !== cur.purchaseUnit ||
      orig.unitsPerPackage !== cur.unitsPerPackage ||
      Math.abs(orig.costPrice - cur.costPrice) > 0.009 ||
      Math.abs(orig.salePrice - cur.salePrice) > 0.009 ||
      Math.abs(orig.cardPrice - cur.cardPrice) > 0.009 ||
      orig.stock !== cur.stock ||
      orig.category !== cur.category ||
      orig.brand !== cur.brand ||
      orig.supplierName !== cur.supplierName
    );
  };

  const modifiedRows = useMemo(() => {
    return Object.values(draftMap).filter((row) => isRowModified(row.id));
  }, [draftMap, originalMap]);

  // Listas dinámicas para filtros de Proveedor, Marca y Categoría
  const availableSuppliers = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name) set.add(s.name);
    });
    Object.values(draftMap).forEach((r) => {
      if (r.supplierName) set.add(r.supplierName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [suppliers, draftMap]);

  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    Object.values(draftMap).forEach((r) => {
      if (r.brand) set.add(r.brand);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [draftMap]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    Object.values(draftMap).forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [draftMap]);

  // Filtrado y Ordenamiento A-Z / Z-A por Nombre o Código
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = Object.values(draftMap).filter((row) => {
      if (supplierFilter !== 'all' && row.supplierName !== supplierFilter) {
        return false;
      }
      if (brandFilter !== 'all' && row.brand !== brandFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && row.category !== categoryFilter) {
        return false;
      }
      if (stockLevelFilter === 'in_stock') {
        if (!(row.stock > 0 && row.stock > row.minStock)) return false;
      } else if (stockLevelFilter === 'low_stock') {
        if (!(row.stock > 0 && row.stock <= row.minStock)) return false;
      } else if (stockLevelFilter === 'out_of_stock') {
        if (!(row.stock <= 0)) return false;
      }
      if (q) {
        const matchesText =
          row.name.toLowerCase().includes(q) ||
          row.sku.toLowerCase().includes(q) ||
          row.brand.toLowerCase().includes(q) ||
          row.category.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const valA = sortField === 'name' ? a.name : a.sku;
      const valB = sortField === 'name' ? b.name : b.sku;
      const cmp = valA.localeCompare(valB, 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [
    draftMap,
    searchQuery,
    supplierFilter,
    brandFilter,
    categoryFilter,
    stockLevelFilter,
    sortField,
    sortDir,
  ]);

  // Actualizar una celda individual con recálculo automático en tiempo real de Costo Unitario ($ Costo Bulto / Unidades)
  const updateCell = (
    id: number,
    field: keyof DraftProductRow,
    rawValue: string | number
  ) => {
    setDraftMap((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const next = { ...cur };

      if (field === 'costPrice') {
        const num = Math.max(0, parseFloat(String(rawValue)) || 0);
        next.costPrice = num;
        next.unitFractionalCost = Number(
          calculateUnitFractionalCost(num, next.unitsPerPackage).toFixed(2)
        );
      } else if (field === 'unitsPerPackage') {
        const units = Math.max(1, Math.round(Number(rawValue) || 1));
        next.unitsPerPackage = units;
        next.unitFractionalCost = Number(
          calculateUnitFractionalCost(next.costPrice, units).toFixed(2)
        );
      } else if (field === 'salePrice') {
        next.salePrice = Math.max(0, parseFloat(String(rawValue)) || 0);
      } else if (field === 'cardPrice') {
        next.cardPrice = Math.max(0, parseFloat(String(rawValue)) || 0);
      } else if (field === 'stock') {
        next.stock = Math.max(0, Math.round(Number(rawValue) || 0));
      } else if (field === 'purchaseUnit') {
        next.purchaseUnit = String(rawValue).toUpperCase();
      } else if (
        field === 'sku' ||
        field === 'name' ||
        field === 'category' ||
        field === 'brand' ||
        field === 'supplierName'
      ) {
        next[field] = String(rawValue);
      }

      return { ...prev, [id]: next };
    });
  };

  // Selección de filas
  const allFilteredSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selectedIds.includes(r.id));

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredRows.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredRows.map((r) => r.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const handleToggleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Mostrar / Ocultar columna (Personalización Dinámica)
  const handleToggleColumn = (colKey: EditableColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(colKey)) {
        if (prev.length <= 2) return prev; // mantener al menos 2 columnas visibles
        return prev.filter((k) => k !== colKey);
      }
      return ALL_COLUMNS.map((c) => c.key).filter(
        (k) => prev.includes(k) || k === colKey
      );
    });
  };

  // =========================================================================
  // APLICADORES DE MODIFICACIONES MASIVAS SOBRE LOS PRODUCTOS SELECCIONADOS
  // =========================================================================

  const targetIdsForBatch =
    selectedIds.length > 0 ? selectedIds : filteredRows.map((r) => r.id);

  // a) Aplicar Configuración Masiva de Empaque / Bulto
  const handleApplyBatchPackaging = () => {
    if (targetIdsForBatch.length === 0) return;
    const units = Math.max(1, Math.round(parseFloat(batchUnitsPerPackage) || 1));
    const hasCustomBulkCost =
      batchBulkCostOptional.trim() !== '' &&
      Number.isFinite(parseFloat(batchBulkCostOptional));
    const customBulkCost = hasCustomBulkCost
      ? Math.max(0, parseFloat(batchBulkCostOptional))
      : null;

    setDraftMap((prev) => {
      const next = { ...prev };
      targetIdsForBatch.forEach((id) => {
        const row = next[id];
        if (!row) return;
        const nextBulkCost =
          customBulkCost !== null ? customBulkCost : row.costPrice;
        const nextUnitCost = Number(
          calculateUnitFractionalCost(nextBulkCost, units).toFixed(2)
        );
        const nextCashPrice = batchRecalcSaleFromUnitCost
          ? Number((nextUnitCost * 1.45).toFixed(2))
          : row.salePrice;
        const nextCardPrice = batchRecalcSaleFromUnitCost
          ? Number((nextCashPrice * 1.15).toFixed(2))
          : row.cardPrice;

        next[id] = {
          ...row,
          purchaseUnit: batchPackageType.toUpperCase(),
          unitsPerPackage: units,
          costPrice: Number(nextBulkCost.toFixed(2)),
          unitFractionalCost: nextUnitCost,
          salePrice: nextCashPrice,
          cardPrice: nextCardPrice,
        };
      });
      return next;
    });
  };

  // b) Aplicar Ajuste Masivo de Precios (% o Monto Fijo $)
  const handleApplyBatchPrices = () => {
    if (targetIdsForBatch.length === 0) return;
    const val = parseFloat(priceValue);
    if (!Number.isFinite(val) || val < 0) return;

    const adjustAmount = (current: number): number => {
      let result = current;
      if (priceMode === 'percent') {
        const factor =
          priceOperation === 'increase' ? 1 + val / 100 : Math.max(0, 1 - val / 100);
        result = current * factor;
      } else {
        result =
          priceOperation === 'increase' ? current + val : Math.max(0, current - val);
      }
      return Number(Math.max(0, result).toFixed(2));
    };

    setDraftMap((prev) => {
      const next = { ...prev };
      targetIdsForBatch.forEach((id) => {
        const row = next[id];
        if (!row) return;
        const nextCost =
          priceTarget === 'all' || priceTarget === 'costPrice'
            ? adjustAmount(row.costPrice)
            : row.costPrice;
        const nextUnitCost = Number(
          calculateUnitFractionalCost(nextCost, row.unitsPerPackage).toFixed(2)
        );
        const nextSale =
          priceTarget === 'all' || priceTarget === 'salePrice'
            ? adjustAmount(row.salePrice)
            : row.salePrice;
        const nextCard =
          priceTarget === 'all' || priceTarget === 'cardPrice'
            ? adjustAmount(row.cardPrice)
            : row.cardPrice;

        next[id] = {
          ...row,
          costPrice: nextCost,
          unitFractionalCost: nextUnitCost,
          salePrice: nextSale,
          cardPrice: nextCard,
        };
      });
      return next;
    });
  };

  // c) Aplicar Ajuste Masivo de Stock (Sumar, Restar o Establecer cantidad fija)
  const handleApplyBatchStock = () => {
    if (targetIdsForBatch.length === 0) return;
    const qty = Math.round(parseFloat(stockValue) || 0);

    setDraftMap((prev) => {
      const next = { ...prev };
      targetIdsForBatch.forEach((id) => {
        const row = next[id];
        if (!row) return;
        let nextStock = row.stock;
        if (stockOperation === 'add') {
          nextStock = Math.max(0, row.stock + qty);
        } else if (stockOperation === 'subtract') {
          nextStock = Math.max(0, row.stock - qty);
        } else {
          nextStock = Math.max(0, qty);
        }
        next[id] = {
          ...row,
          stock: nextStock,
        };
      });
      return next;
    });
  };

  // d) Aplicar Asignación Masiva de Proveedor, Categoría o Marca
  const handleApplyBatchAssignment = () => {
    if (targetIdsForBatch.length === 0) return;
    if (
      !assignSupplier.trim() &&
      !assignCategory.trim() &&
      !assignBrand.trim()
    ) {
      return;
    }

    setDraftMap((prev) => {
      const next = { ...prev };
      targetIdsForBatch.forEach((id) => {
        const row = next[id];
        if (!row) return;
        next[id] = {
          ...row,
          supplierName: assignSupplier.trim()
            ? assignSupplier.trim()
            : row.supplierName,
          category: assignCategory.trim() ? assignCategory.trim() : row.category,
          brand: assignBrand.trim() ? assignBrand.trim() : row.brand,
        };
      });
      return next;
    });
  };

  // Deshacer cambios en borrador
  const handleResetAllChanges = () => {
    setDraftMap(originalMap);
  };

  // Confirmar y Guardar Cambios Masivos en Base de Datos
  const handleConfirmSaveBatchChanges = async () => {
    if (modifiedRows.length === 0) {
      setPreviewModalOpen(false);
      return;
    }

    setIsSavingBatch(true);
    try {
      const payload = modifiedRows.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        purchaseUnit: row.purchaseUnit,
        unitsPerPackage: row.unitsPerPackage,
        costPrice: row.costPrice.toFixed(2),
        salePrice: row.salePrice.toFixed(2),
        cardPrice: row.cardPrice.toFixed(2),
        stock: row.stock,
        category: row.category,
        brand: row.brand,
        supplierName: row.supplierName,
      }));

      const res = await fetch('/api/products/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudieron guardar los cambios masivos.'
        );
      }

      // Persistir también en metadatos extendidos locales (empaque, unidades x bulto, costo unitario, precio tarjeta)
      let currentMetaMap = loadProductExtendedMetaMap();
      modifiedRows.forEach((row) => {
        currentMetaMap = saveProductExtendedMeta(row.id, {
          purchaseUnit: row.purchaseUnit,
          unitsPerPackage: row.unitsPerPackage,
          unitFractionalCost: row.unitFractionalCost,
          cardPrice: row.cardPrice.toFixed(2),
        });
      });

      const returnedProducts: ProductItem[] = Array.isArray(data.products)
        ? data.products
        : [];
      const enriched = returnedProducts.map((p) =>
        enrichProductWithExtendedMeta(p, currentMetaMap)
      );

      onProductsUpdated(
        enriched,
        `¡Se guardaron los cambios masivos en ${modifiedRows.length} producto(s) exitosamente!`
      );
      setPreviewModalOpen(false);
    } catch (err: any) {
      console.error('Error saving batch product changes:', err);
    } finally {
      setIsSavingBatch(false);
    }
  };

  const hiddenColumns = ALL_COLUMNS.filter(
    (c) => !visibleColumns.includes(c.key)
  );

  // Vista en vivo del cálculo automático de Costo Unitario en la pestaña de Empaque
  const livePreviewBulkCost =
    batchBulkCostOptional.trim() !== '' &&
    Number.isFinite(parseFloat(batchBulkCostOptional))
      ? Math.max(0, parseFloat(batchBulkCostOptional))
      : filteredRows[0]?.costPrice || 10000;
  const livePreviewUnits = Math.max(
    1,
    Math.round(parseFloat(batchUnitsPerPackage) || 1)
  );
  const livePreviewUnitCost = calculateUnitFractionalCost(
    livePreviewBulkCost,
    livePreviewUnits
  );

  return (
    <div className="space-y-3.5">
      {/* ====================================================================
          1. BARRA SUPERIOR: IMPORTACIÓN Y DESCARGA DE PLANTILLAS BASE (CSV / EXCEL)
         ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Card 1: Proveedores */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Importar Proveedores
                </h3>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  RAZON SOCIAL · CUIT · TELEFONO · EMAIL · DIRECCION · NOTAS
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenImportModal('suppliers')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Proveedores</span>
            </button>
            <button
              type="button"
              onClick={() => downloadBaseEntityTemplate('suppliers', 'xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
            >
              <Download className="w-3 h-3 text-[#FF6600]" />
              <span>Descargar Plantilla Base (.XLSX)</span>
            </button>
            <button
              type="button"
              onClick={() => downloadBaseEntityTemplate('suppliers', 'csv')}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold cursor-pointer"
            >
              <span>.CSV</span>
            </button>
          </div>
        </div>

        {/* Card 2: Productos */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 text-[#FF6600] flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Importar Productos (Por Bulto / Unidad)
                </h3>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  CODIGO_SKU · NOMBRE · UNIDAD_EMPAQUE · UNIDADES_POR_BULTO · COSTO...
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenImportModal('products')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Productos</span>
            </button>
            <button
              type="button"
              onClick={() => downloadBaseEntityTemplate('products', 'xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
            >
              <Download className="w-3 h-3 text-[#FF6600]" />
              <span>Descargar Plantilla Base (.XLSX)</span>
            </button>
            <button
              type="button"
              onClick={() => downloadBaseEntityTemplate('products', 'csv')}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold cursor-pointer"
            >
              <span>.CSV</span>
            </button>
          </div>
        </div>

        {/* Card 3: Clientes */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Importar Clientes
                </h3>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  NOMBRE · TELEFONO · CUIT · DNI · DEUDA TOTAL
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenImportModal('clients')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Clientes</span>
            </button>
            <button
              type="button"
              onClick={() => downloadBaseEntityTemplate('clients', 'xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
            >
              <Download className="w-3 h-3 text-[#FF6600]" />
              <span>Descargar Plantilla Base (.XLSX)</span>
            </button>
            <button
              type="button"
              onClick={() => downloadBaseEntityTemplate('clients', 'csv')}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-semibold cursor-pointer"
            >
              <span>.CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. APLICADOR DE MODIFICACIONES MASIVAS (EMPAQUE / PRECIOS / STOCK / ASIGNACIÓN)
         ==================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#FF6600]" />
              <span>Aplicador de Modificaciones Masivas en Lote</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#FF6600]/20 border border-[#FF6600]/40 text-amber-300 font-mono text-xs font-bold">
              {selectedIds.length > 0
                ? `${selectedIds.length} seleccionados`
                : `Aplicará a los ${filteredRows.length} filtrados`}
            </span>
          </div>

          {/* Botones de Selección Masiva + Botón Guardar Cambios con Vista Previa */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAllFiltered}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Deseleccionar Filtrados ({filteredRows.length})</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>Seleccionar Todos los Filtrados ({filteredRows.length})</span>
                </>
              )}
            </button>

            {modifiedRows.length > 0 && (
              <button
                type="button"
                onClick={handleResetAllChanges}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Descartar ({modifiedRows.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              disabled={modifiedRows.length === 0}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                modifiedRows.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>
                Guardar Cambios Masivos ({modifiedRows.length} modificados)
              </span>
            </button>
          </div>
        </div>

        {/* Selector de las 4 herramientas en lote */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              id: 'packaging' as const,
              label: 'a) Empaque / Bulto y Costo Unitario',
              icon: Boxes,
            },
            {
              id: 'prices' as const,
              label: 'b) Ajuste Masivo de Precios (% o $)',
              icon: Percent,
            },
            {
              id: 'stock' as const,
              label: 'c) Ajuste Masivo de Stock (+ / - / =)',
              icon: Package,
            },
            {
              id: 'assign' as const,
              label: 'd) Asignar Proveedor, Categoría o Marca',
              icon: Tag,
            },
          ].map((t) => {
            const Icon = t.icon;
            const isAct = activeBatchTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveBatchTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  isAct
                    ? 'bg-[#FF6600] text-white'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel a) Configuración Masiva de Empaque / Bulto con Cálculo Automático en Tiempo Real */}
        {activeBatchTab === 'packaging' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Tipo de Empaque
              </label>
              <select
                value={batchPackageType}
                onChange={(e) => setBatchPackageType(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              >
                <option value="CAJA">Caja</option>
                <option value="ROLLO">Rollo</option>
                <option value="PAQUETE">Paquete</option>
                <option value="BULTO">Bulto</option>
                <option value="PALLET">Pallet</option>
                <option value="BOLSA">Bolsa</option>
                <option value="BALDE">Balde</option>
                <option value="UNIDAD">Unidad</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Unidades x Bulto
              </label>
              <input
                type="number"
                min={1}
                value={batchUnitsPerPackage}
                onChange={(e) => setBatchUnitsPerPackage(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Costo Bulto $ (Opcional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Mantener actual"
                value={batchBulkCostOptional}
                onChange={(e) => setBatchBulkCostOptional(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div className="md:col-span-4 p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
              <div className="text-[11px]">
                <span className="text-slate-400 block">
                  Cálculo Automático Costo Unitario:
                </span>
                <span className="font-mono font-extrabold text-amber-400">
                  {formatCurrency(livePreviewBulkCost)} / {livePreviewUnits} u. ={' '}
                  {formatCurrency(livePreviewUnitCost)} c/u
                </span>
              </div>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={batchRecalcSaleFromUnitCost}
                  onChange={(e) =>
                    setBatchRecalcSaleFromUnitCost(e.target.checked)
                  }
                  className="w-3.5 h-3.5 accent-[#FF6600]"
                />
                <span>Recalcular Venta</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleApplyBatchPackaging}
                className="w-full py-2 px-3 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors"
              >
                Aplicar Empaque
              </button>
            </div>
          </div>
        )}

        {/* Panel b) Ajuste Masivo de Precios */}
        {activeBatchTab === 'prices' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Acción sobre Precios
              </label>
              <select
                value={priceOperation}
                onChange={(e) =>
                  setPriceOperation(e.target.value as 'increase' | 'decrease')
                }
                className="w-full px-2.5 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              >
                <option value="increase">Incrementar (+ Aumento)</option>
                <option value="decrease">Reducir (- Descuento)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Tipo de Valor
              </label>
              <select
                value={priceMode}
                onChange={(e) =>
                  setPriceMode(e.target.value as 'percent' | 'fixed')
                }
                className="w-full px-2.5 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              >
                <option value="percent">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo ($)</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Aplicar Sobre Columna
              </label>
              <select
                value={priceTarget}
                onChange={(e) => setPriceTarget(e.target.value as any)}
                className="w-full px-2.5 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              >
                <option value="all">
                  Todos (Costo, Efectivo y Tarjeta)
                </option>
                <option value="costPrice">Precio Costo (Bulto y Unitario)</option>
                <option value="salePrice">Precio Efectivo Unidad</option>
                <option value="cardPrice">Precio Tarjeta Unidad</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Valor ({priceMode === 'percent' ? '%' : '$'})
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleApplyBatchPrices}
                className="w-full py-2 px-3 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors"
              >
                Aplicar a Precios
              </button>
            </div>
          </div>
        )}

        {/* Panel c) Ajuste Masivo de Stock */}
        {activeBatchTab === 'stock' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Operación de Stock
              </label>
              <select
                value={stockOperation}
                onChange={(e) =>
                  setStockOperation(
                    e.target.value as 'add' | 'subtract' | 'set'
                  )
                }
                className="w-full px-2.5 py-2 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              >
                <option value="add">Sumar unidades al stock actual (+)</option>
                <option value="subtract">
                  Restar unidades al stock actual (-)
                </option>
                <option value="set">
                  Establecer cantidad fija de stock (=)
                </option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Cantidad de Unidades
              </label>
              <input
                type="number"
                min={0}
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="button"
                onClick={handleApplyBatchStock}
                className="w-full py-2 px-3 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors"
              >
                Aplicar Ajuste de Stock
              </button>
            </div>
          </div>
        )}

        {/* Panel d) Asignar Masivamente Proveedor, Categoría o Marca */}
        {activeBatchTab === 'assign' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Nuevo Proveedor (Opcional)
              </label>
              <input
                type="text"
                list="bulk-suppliers-datalist"
                placeholder="Ej: Distribuidora El Tornillo"
                value={assignSupplier}
                onChange={(e) => setAssignSupplier(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6600]"
              />
              <datalist id="bulk-suppliers-datalist">
                {availableSuppliers.map((sup) => (
                  <option key={sup} value={sup} />
                ))}
              </datalist>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Nueva Categoría (Opcional)
              </label>
              <input
                type="text"
                list="bulk-categories-datalist"
                placeholder="Ej: Herramientas Eléctricas"
                value={assignCategory}
                onChange={(e) => setAssignCategory(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6600]"
              />
              <datalist id="bulk-categories-datalist">
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Nueva Marca (Opcional)
              </label>
              <input
                type="text"
                list="bulk-brands-datalist"
                placeholder="Ej: Bosch / Makita"
                value={assignBrand}
                onChange={(e) => setAssignBrand(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6600]"
              />
              <datalist id="bulk-brands-datalist">
                {availableBrands.map((br) => (
                  <option key={br} value={br} />
                ))}
              </datalist>
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleApplyBatchAssignment}
                className="w-full py-2 px-3 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold cursor-pointer transition-colors"
              >
                Asignar en Lote
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          3. CABECERA DE FILTROS AVANZADOS, ORDENAMIENTO Y PERSONALIZACIÓN DE COLUMNAS
         ==================================================================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
          {/* Buscador global (Nombre, SKU, Código) */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Buscador Global (Nombre, SKU, Código)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, SKU o código..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white"
              />
            </div>
          </div>

          {/* Filtro por Proveedor */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filtro por Proveedor
            </label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
            >
              <option value="all">Todos los proveedores</option>
              {availableSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Nivel de Stock */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Nivel de Stock
            </label>
            <select
              value={stockLevelFilter}
              onChange={(e) =>
                setStockLevelFilter(e.target.value as StockLevelFilter)
              }
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
            >
              <option value="all">Todos los niveles</option>
              <option value="in_stock">En stock (Normal)</option>
              <option value="low_stock">Stock bajo (Alerta)</option>
              <option value="out_of_stock">Sin stock (0 u.)</option>
            </select>
          </div>

          {/* Filtro por Marca */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filtro por Marca
            </label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
            >
              <option value="all">Todas las marcas</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Categoría */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filtro por Categoría
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
            >
              <option value="all">Todas las categorías</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenamiento A-Z / Z-A por Nombre o Código */}
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Ordenar
            </label>
            <button
              type="button"
              onClick={() => {
                if (sortDir === 'asc') {
                  setSortDir('desc');
                } else {
                  setSortField((prev) => (prev === 'name' ? 'sku' : 'name'));
                  setSortDir('asc');
                }
              }}
              title="Cambiar orden A-Z / Z-A por Nombre o Código SKU"
              className="w-full px-2 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
              <span className="truncate">
                {sortField === 'name' ? 'Nom.' : 'SKU'}{' '}
                {sortDir === 'asc' ? 'A-Z' : 'Z-A'}
              </span>
            </button>
          </div>
        </div>

        {/* Barra de Personalización Dinámica de Columnas (Agregar / Eliminar Columnas Visibles) */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setColumnsMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              <Columns3 className="w-3.5 h-3.5 text-[#FF6600]" />
              <span>
                Personalizar Columnas ({visibleColumns.length}/{ALL_COLUMNS.length})
              </span>
            </button>

            {/* Botones rápidos para Agregar columnas que estén ocultas */}
            {hiddenColumns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-slate-500 font-semibold ml-1">
                  Agregar columna:
                </span>
                {hiddenColumns.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => handleToggleColumn(col.key)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#FF6600] text-[11px] font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{col.shortLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Mostrando <strong>{filteredRows.length}</strong> productos
            </span>
            <span>·</span>
            <span>
              Orden:{' '}
              <strong>
                {sortField === 'name' ? 'Nombre' : 'Código SKU'} (
                {sortDir === 'asc' ? 'A-Z' : 'Z-A'})
              </strong>
            </span>
          </div>
        </div>

        {/* Panel desplegable para activar/desactivar columnas */}
        {columnsMenuOpen && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">
                Mostrar u Ocultar Columnas de la Planilla Editable
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleColumns(ALL_COLUMNS.map((c) => c.key))
                  }
                  className="text-xs font-bold text-[#FF6600] hover:underline cursor-pointer"
                >
                  Mostrar Todas (12)
                </button>
                <button
                  type="button"
                  onClick={() => setColumnsMenuOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {ALL_COLUMNS.map((col) => {
                const isVis = visibleColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      isVis
                        ? 'bg-white border-[#FF6600] text-slate-900'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isVis}
                      onChange={() => handleToggleColumn(col.key)}
                      className="w-3.5 h-3.5 accent-[#FF6600]"
                    />
                    <span className="truncate">{col.shortLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          4. GRILLA / PLANILLA EDITABLE DE PRODUCTOS
         ==================================================================== */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white">
              <tr className="text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAllFiltered}
                    className="w-3.5 h-3.5 accent-[#FF6600] cursor-pointer"
                  />
                </th>
                {ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map(
                  (col) => (
                    <th
                      key={col.key}
                      className={`py-2.5 px-2.5 whitespace-nowrap ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 ${
                          col.align === 'right' ? 'justify-end w-full' : ''
                        }`}
                      >
                        {(col.key === 'name' || col.key === 'sku') && (
                          <button
                            type="button"
                            onClick={() => {
                              if (sortField === col.key) {
                                setSortDir((d) =>
                                  d === 'asc' ? 'desc' : 'asc'
                                );
                              } else {
                                setSortField(col.key);
                                setSortDir('asc');
                              }
                            }}
                            className="inline-flex items-center gap-1 hover:text-[#FF6600] cursor-pointer"
                          >
                            <span>{col.shortLabel}</span>
                            <ArrowUpDown className="w-3 h-3 text-[#FF6600]" />
                          </button>
                        )}
                        {col.key !== 'name' && col.key !== 'sku' && (
                          <span>{col.shortLabel}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleColumn(col.key)}
                          title={`Ocultar columna ${col.label}`}
                          className="text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="py-12 text-center text-slate-500 space-y-2"
                  >
                    <p className="font-bold text-slate-700">
                      No hay productos que coincidan con los filtros actuales o el catálogo está vacío.
                    </p>
                    <p className="text-xs text-slate-500">
                      Utilice los botones superiores para <strong>Importar Productos</strong> o descargar la <strong>Plantilla Base</strong>.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  const modified = isRowModified(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        modified
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : isSelected
                          ? 'bg-orange-50/40 hover:bg-orange-50/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(row.id)}
                          className="w-3.5 h-3.5 accent-[#FF6600] cursor-pointer"
                        />
                      </td>

                      {visibleColumns.includes('sku') && (
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) =>
                              updateCell(row.id, 'sku', e.target.value)
                            }
                            className="w-28 px-2 py-1 font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('name') && (
                        <td className="py-1.5 px-2 min-w-[220px]">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              updateCell(row.id, 'name', e.target.value)
                            }
                            className="w-full px-2 py-1 font-semibold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('purchaseUnit') && (
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <select
                            value={row.purchaseUnit}
                            onChange={(e) =>
                              updateCell(row.id, 'purchaseUnit', e.target.value)
                            }
                            className="px-2 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          >
                            {PACKAGE_TYPE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {visibleColumns.includes('unitsPerPackage') && (
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min={1}
                            value={row.unitsPerPackage}
                            onChange={(e) =>
                              updateCell(
                                row.id,
                                'unitsPerPackage',
                                e.target.value
                              )
                            }
                            className="w-20 px-2 py-1 text-right font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('costPrice') && (
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.costPrice}
                            onChange={(e) =>
                              updateCell(row.id, 'costPrice', e.target.value)
                            }
                            className="w-28 px-2 py-1 text-right font-mono font-semibold text-slate-900 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('unitFractionalCost') && (
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-extrabold text-[#FF6600] whitespace-nowrap bg-orange-50/40">
                          {formatCurrency(row.unitFractionalCost)}
                        </td>
                      )}

                      {visibleColumns.includes('salePrice') && (
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.salePrice}
                            onChange={(e) =>
                              updateCell(row.id, 'salePrice', e.target.value)
                            }
                            className="w-28 px-2 py-1 text-right font-mono font-bold text-emerald-700 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('cardPrice') && (
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.cardPrice}
                            onChange={(e) =>
                              updateCell(row.id, 'cardPrice', e.target.value)
                            }
                            className="w-28 px-2 py-1 text-right font-mono font-bold text-sky-700 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('stock') && (
                        <td className="py-1.5 px-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min={0}
                            value={row.stock}
                            onChange={(e) =>
                              updateCell(row.id, 'stock', e.target.value)
                            }
                            className={`w-20 px-2 py-1 text-right font-mono font-bold bg-white border rounded focus:outline-none focus:border-[#FF6600] ${
                              row.stock <= 0
                                ? 'text-rose-700 border-rose-300'
                                : row.stock <= row.minStock
                                ? 'text-amber-700 border-amber-300'
                                : 'text-slate-900 border-slate-200'
                            }`}
                          />
                        </td>
                      )}

                      {visibleColumns.includes('category') && (
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <input
                            type="text"
                            value={row.category}
                            onChange={(e) =>
                              updateCell(row.id, 'category', e.target.value)
                            }
                            className="w-36 px-2 py-1 text-slate-800 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('brand') && (
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <input
                            type="text"
                            value={row.brand}
                            onChange={(e) =>
                              updateCell(row.id, 'brand', e.target.value)
                            }
                            className="w-28 px-2 py-1 text-slate-800 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}

                      {visibleColumns.includes('supplierName') && (
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          <input
                            type="text"
                            list="bulk-suppliers-datalist"
                            value={row.supplierName}
                            onChange={(e) =>
                              updateCell(row.id, 'supplierName', e.target.value)
                            }
                            className="w-44 px-2 py-1 text-slate-800 bg-white border border-slate-200 rounded focus:outline-none focus:border-[#FF6600]"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          5. MODAL DE VISTA PREVIA ANTES DE GUARDAR CAMBIOS MASIVOS
         ==================================================================== */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Vista Previa de Cambios Masivos ({modifiedRows.length} productos modificados)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Verifique los nuevos valores de empaque, costo unitario, precios y stock antes de aplicar en la base de datos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600">
                      <th className="py-2.5 px-3">SKU / Producto</th>
                      <th className="py-2.5 px-3">Empaque x Bulto</th>
                      <th className="py-2.5 px-3 text-right">Costo Bulto</th>
                      <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                      <th className="py-2.5 px-3 text-right">Efectivo Unid.</th>
                      <th className="py-2.5 px-3 text-right">Tarjeta Unid.</th>
                      <th className="py-2.5 px-3 text-right">Stock</th>
                      <th className="py-2.5 px-3">Proveedor / Rubro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {modifiedRows.map((row) => {
                      const orig = originalMap[row.id];
                      return (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <div className="font-mono font-bold text-slate-900">
                              {row.sku}
                            </div>
                            <div className="text-slate-600">{row.name}</div>
                          </td>
                          <td className="py-2 px-3 font-mono whitespace-nowrap">
                            {orig &&
                              (orig.purchaseUnit !== row.purchaseUnit ||
                                orig.unitsPerPackage !== row.unitsPerPackage) && (
                                <span className="line-through text-slate-400 mr-1.5">
                                  {orig.purchaseUnit} x {orig.unitsPerPackage}
                                </span>
                              )}
                            <span className="font-bold text-slate-900">
                              {row.purchaseUnit} x {row.unitsPerPackage} u.
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                            {orig &&
                              Math.abs(orig.costPrice - row.costPrice) > 0.01 && (
                                <span className="line-through text-slate-400 block text-[10px]">
                                  {formatCurrency(orig.costPrice)}
                                </span>
                              )}
                            <span className="font-bold text-slate-900">
                              {formatCurrency(row.costPrice)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-[#FF6600] whitespace-nowrap">
                            {formatCurrency(row.unitFractionalCost)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                            {orig &&
                              Math.abs(orig.salePrice - row.salePrice) > 0.01 && (
                                <span className="line-through text-slate-400 block text-[10px]">
                                  {formatCurrency(orig.salePrice)}
                                </span>
                              )}
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(row.salePrice)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                            {orig &&
                              Math.abs(orig.cardPrice - row.cardPrice) > 0.01 && (
                                <span className="line-through text-slate-400 block text-[10px]">
                                  {formatCurrency(orig.cardPrice)}
                                </span>
                              )}
                            <span className="font-bold text-sky-700">
                              {formatCurrency(row.cardPrice)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                            {orig && orig.stock !== row.stock && (
                              <span className="line-through text-slate-400 mr-1.5">
                                {orig.stock}
                              </span>
                            )}
                            <span className="font-extrabold text-slate-900">
                              {row.stock} u.
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-700">
                            <div className="font-semibold">{row.supplierName}</div>
                            <div className="text-slate-500">
                              {row.category} · {row.brand}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Seguir Editando
              </button>
              <button
                type="button"
                disabled={isSavingBatch}
                onClick={handleConfirmSaveBatchChanges}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSavingBatch
                    ? 'Guardando Cambios...'
                    : `Confirmar y Guardar (${modifiedRows.length} productos)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
