import React, { useState, useMemo, useEffect } from 'react';
import {
  Tag,
  Percent,
  Plus,
  CheckCircle2,
  Calculator,
  Truck,
  Layers,
  Sparkles,
  Save,
  Trash2,
  Pencil,
  Check,
  Search,
  RefreshCw,
  CreditCard,
  Wallet,
  Building2,
  Users,
  Crown,
  Columns3,
  FileSpreadsheet,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { ProductItem, SupplierItem } from '../types/ferreteria.ts';
import {
  enrichProductWithExtendedMeta,
  saveProductExtendedMeta,
  loadProductExtendedMetaMap,
  calculateUnitFractionalCost,
  getSingularContentTypeLabel,
} from './ProductsModule.tsx';
import {
  TablePaginationBar,
  PageSizeOption,
  paginateArray,
} from './TablePaginationBar.tsx';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const CUSTOM_PRICE_LISTS_STORAGE_KEY =
  'ferreteria_del_puente_custom_price_lists_v3';

export type PriceListChannelType =
  | 'Efectivo / Contado'
  | 'Cuenta Corriente'
  | 'Tarjeta / Cuotas'
  | 'Mayorista / Gremio'
  | 'Cliente VIP';

export type PriceListScopeType = 'all' | 'suppliers' | 'categories';

export interface CustomPriceListRule {
  id: string;
  name: string;
  channelType: PriceListChannelType;
  scopeType: PriceListScopeType;
  selectedSuppliers: string[];
  selectedCategories: string[];
  supplierDiscountPct: number; // Descuento de Proveedor (%)
  profitMarginPct: number; // Margen de Ganancia (%)
  surchargePct: number; // Recargo / Adicional (%)
  autoRecalculateOnCostUpdate: boolean;
  updatedAt: string;
}

const DEFAULT_PRICE_LISTS: CustomPriceListRule[] = [
  {
    id: 'lista-normal',
    name: 'Lista de Precio Normal',
    channelType: 'Efectivo / Contado',
    scopeType: 'all',
    selectedSuppliers: [],
    selectedCategories: [],
    supplierDiscountPct: 0,
    profitMarginPct: 60,
    surchargePct: 0,
    autoRecalculateOnCostUpdate: true,
    updatedAt: 'Activa · Por Defecto',
  },
  {
    id: 'lista-tarjeta',
    name: 'Lista de Precio Tarjeta',
    channelType: 'Tarjeta / Cuotas',
    scopeType: 'all',
    selectedSuppliers: [],
    selectedCategories: [],
    supplierDiscountPct: 0,
    profitMarginPct: 60,
    surchargePct: 9,
    autoRecalculateOnCostUpdate: true,
    updatedAt: 'Activa · Tarjeta',
  },
  {
    id: 'lista-cta-cte',
    name: 'Cuenta Corriente Comercial (30 días)',
    channelType: 'Cuenta Corriente',
    scopeType: 'all',
    selectedSuppliers: [],
    selectedCategories: [],
    supplierDiscountPct: 0,
    profitMarginPct: 60,
    surchargePct: 12,
    autoRecalculateOnCostUpdate: true,
    updatedAt: 'Activa · +12% Cta. Cte.',
  },
  {
    id: 'lista-mayorista',
    name: 'Lista Mayorista / Gremio',
    channelType: 'Mayorista / Gremio',
    scopeType: 'all',
    selectedSuppliers: [],
    selectedCategories: [],
    supplierDiscountPct: 10,
    profitMarginPct: 35,
    surchargePct: 0,
    autoRecalculateOnCostUpdate: true,
    updatedAt: 'Activa · Gremio / Obras',
  },
];

export function loadCustomPriceLists(): CustomPriceListRule[] {
  if (typeof window === 'undefined') return DEFAULT_PRICE_LISTS;
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRICE_LISTS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRICE_LISTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_PRICE_LISTS;
  } catch {
    return DEFAULT_PRICE_LISTS;
  }
}

export const loadPriceListsFromStorage = loadCustomPriceLists;

export function saveCustomPriceLists(
  lists: CustomPriceListRule[]
): CustomPriceListRule[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        CUSTOM_PRICE_LISTS_STORAGE_KEY,
        JSON.stringify(lists)
      );
    } catch {
      // ignore storage errors
    }
  }
  return lists;
}

/**
 * Calcula los precios de un producto aplicando la fórmula de 3 pasos:
 * 1. Costo Neto con Descuento de Proveedor (%) = Costo Base * (1 - supplierDiscountPct / 100)
 * 2. Precio Base con Margen de Ganancia (%) = Costo Neto * (1 + profitMarginPct / 100)
 * 3. Precio Final con Recargo / Adicional (%) = Precio Base * (1 + surchargePct / 100)
 */
export function calculateFormulaPrices(
  baseCost: number,
  supplierDiscountPct: number,
  profitMarginPct: number,
  surchargePct: number
): {
  netCostAfterDiscount: number;
  cashSalePrice: number;
  finalListPriceWithSurcharge: number;
} {
  const safeCost = Number.isFinite(baseCost) && baseCost >= 0 ? baseCost : 0;
  const disc = Math.max(0, Math.min(99, supplierDiscountPct || 0));
  const margin = Number.isFinite(profitMarginPct) ? profitMarginPct : 0;
  const surcharge = Number.isFinite(surchargePct) ? surchargePct : 0;

  const netCostAfterDiscount = safeCost * (1 - disc / 100);
  const cashSalePrice = netCostAfterDiscount * (1 + margin / 100);
  const finalListPriceWithSurcharge = cashSalePrice * (1 + surcharge / 100);

  return {
    netCostAfterDiscount,
    cashSalePrice,
    finalListPriceWithSurcharge,
  };
}

export function calculateProductPriceForRule(
  product: ProductItem,
  rule: CustomPriceListRule
): {
  netCost: number;
  baseMarginPrice: number;
  finalPrice: number;
} {
  const enriched = enrichProductWithExtendedMeta(product);
  const baseUnitCost =
    enriched.unitFractionalCost ??
    calculateUnitFractionalCost(
      enriched.costPrice,
      enriched.unitsPerPackage || 1
    );
  const res = calculateFormulaPrices(
    baseUnitCost,
    rule.supplierDiscountPct,
    rule.profitMarginPct,
    rule.surchargePct
  );
  return {
    netCost: res.netCostAfterDiscount,
    baseMarginPrice: res.cashSalePrice,
    finalPrice: res.finalListPriceWithSurcharge,
  };
}

interface PriceListsModuleProps {
  products: ProductItem[];
  suppliers: SupplierItem[];
  onProductsUpdated: (newProducts: ProductItem[], message: string) => void;
  onOpenBulkImport: () => void;
  formatCurrency: (val: string | number) => string;
}

type PriceTableColumnKey =
  | 'sku'
  | 'name'
  | 'category'
  | 'costPrice'
  | 'marginPct'
  | 'cashPrice'
  | 'cardListPrice';

const PRICE_TABLE_COLUMNS: {
  key: PriceTableColumnKey;
  label: string;
  align?: 'left' | 'right' | 'center';
}[] = [
  { key: 'sku', label: 'Código', align: 'left' },
  { key: 'name', label: 'Nombre / Producto', align: 'left' },
  { key: 'category', label: 'Categoría', align: 'left' },
  { key: 'costPrice', label: 'Precio de Costo', align: 'right' },
  { key: 'marginPct', label: 'Margen de Ganancia %', align: 'right' },
  {
    key: 'cashPrice',
    label: 'Precio de Venta (Contado / Efectivo)',
    align: 'right',
  },
  {
    key: 'cardListPrice',
    label: 'Precio Lista / Tarjeta',
    align: 'right',
  },
];

export const PriceListsModule: React.FC<PriceListsModuleProps> = ({
  products,
  suppliers,
  onProductsUpdated,
  onOpenBulkImport,
  formatCurrency,
}) => {
  const [priceLists, setPriceLists] = useState<CustomPriceListRule[]>(() =>
    loadCustomPriceLists()
  );
  const [activeListId, setActiveListId] = useState<string>(
    () => loadCustomPriceLists()[0]?.id || 'lista-contado'
  );

  // Estado del constructor / editor de Lista de Precios y Regla de Cálculo
  const [editingRuleName, setEditingRuleName] = useState<string>('');
  const [channelType, setChannelType] =
    useState<PriceListChannelType>('Efectivo / Contado');
  const [scopeType, setScopeType] = useState<PriceListScopeType>('all');
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [supplierDiscountPct, setSupplierDiscountPct] = useState<string>('0');
  const [profitMarginPct, setProfitMarginPct] = useState<string>('45');
  const [surchargePct, setSurchargePct] = useState<string>('18');
  const [autoRecalculate, setAutoRecalculate] = useState<boolean>(true);

  // Modal para crear nueva lista personalizada
  const [newListModalOpen, setNewListModalOpen] = useState<boolean>(false);
  const [newListForm, setNewListForm] = useState({
    name: '',
    channelType: 'Tarjeta / Cuotas' as PriceListChannelType,
    supplierDiscountPct: '0',
    profitMarginPct: '45',
    surchargePct: '15',
  });

  // Búsqueda y configuración de columnas visibles en la tabla de Precios
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleColumns, setVisibleColumns] = useState<
    Record<PriceTableColumnKey, boolean>
  >({
    sku: true,
    name: true,
    category: true,
    costPrice: true,
    marginPct: true,
    cashPrice: true,
    cardListPrice: true,
  });
  const [columnsMenuOpen, setColumnsMenuOpen] = useState<boolean>(false);
  const [isApplyingBulk, setIsApplyingBulk] = useState<boolean>(false);

  // Estado de Edición Rápida (Inline) en la tabla de Precios
  const [inlinePriceDrafts, setInlinePriceDrafts] = useState<
    Record<
      number,
      {
        unitCost: string;
        marginPct: string;
        cashPrice: string;
        cardListPrice: string;
      }
    >
  >({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);

  const activeList = useMemo(
    () => priceLists.find((l) => l.id === activeListId) || priceLists[0],
    [priceLists, activeListId]
  );

  // Sincronizar los controles del panel cuando el usuario selecciona otra Lista de Precios
  useEffect(() => {
    if (!activeList) return;
    setEditingRuleName(activeList.name);
    setChannelType(activeList.channelType);
    setScopeType(activeList.scopeType);
    setSelectedSuppliers(activeList.selectedSuppliers || []);
    setSelectedCategories(activeList.selectedCategories || []);
    setSupplierDiscountPct(String(activeList.supplierDiscountPct ?? 0));
    setProfitMarginPct(String(activeList.profitMarginPct ?? 45));
    setSurchargePct(String(activeList.surchargePct ?? 0));
    setAutoRecalculate(activeList.autoRecalculateOnCostUpdate !== false);
  }, [activeListId]);

  const allSupplierNames = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name) set.add(s.name);
    });
    products.forEach((p) => {
      if (p.supplierName) set.add(p.supplierName);
    });
    return Array.from(set);
  }, [suppliers, products]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const parsedSupplierDiscount = Math.max(
    0,
    Math.min(99, parseFloat(supplierDiscountPct.replace(',', '.')) || 0)
  );
  const parsedProfitMargin =
    parseFloat(profitMarginPct.replace(',', '.')) || 0;
  const parsedSurcharge = parseFloat(surchargePct.replace(',', '.')) || 0;

  //Recargo de referencia para la columna "Precio Lista / Tarjeta" cuando la lista activa tiene 0% de recargo
  const effectiveCardSurchargePct = useMemo(() => {
    if (parsedSurcharge > 0) return parsedSurcharge;
    const cardList = priceLists.find(
      (l) => l.channelType === 'Tarjeta / Cuotas' || l.surchargePct > 0
    );
    return cardList ? cardList.surchargePct : 18;
  }, [parsedSurcharge, priceLists]);

  // Inicializar borradores de edición rápida (inline) por fila
  useEffect(() => {
    const metaMap = loadProductExtendedMetaMap();
    const nextDrafts: Record<
      number,
      {
        unitCost: string;
        marginPct: string;
        cashPrice: string;
        cardListPrice: string;
      }
    > = {};

    products.forEach((rawProd) => {
      const prod = enrichProductWithExtendedMeta(rawProd, metaMap);
      const unitCost =
        prod.unitFractionalCost ??
        calculateUnitFractionalCost(prod.costPrice, prod.unitsPerPackage || 1);
      const margin = prod.retailMarginPct ?? 45;
      const cashSale = parseFloat(String(prod.salePrice || '0')) || 0;
      const cardPrice = cashSale * (1 + effectiveCardSurchargePct / 100);

      nextDrafts[prod.id] = {
        unitCost: unitCost.toFixed(2),
        marginPct: Number(margin).toFixed(2),
        cashPrice: cashSale.toFixed(2),
        cardListPrice: cardPrice.toFixed(2),
      };
    });
    setInlinePriceDrafts(nextDrafts);
  }, [products, effectiveCardSurchargePct]);

  // Determinar si un producto entra en los Filtros de Selección configurados
  const doesProductMatchRuleScope = (prod: ProductItem): boolean => {
    if (scopeType === 'all') return true;
    if (scopeType === 'suppliers') {
      if (selectedSuppliers.length === 0) return true;
      return selectedSuppliers.includes(prod.supplierName);
    }
    if (scopeType === 'categories') {
      if (selectedCategories.length === 0) return true;
      return selectedCategories.includes(prod.category);
    }
    return true;
  };

  // Productos filtrados por alcance de la regla y búsqueda
  const matchingScopeProducts = useMemo(
    () => products.filter((p) => doesProductMatchRuleScope(p)),
    [products, scopeType, selectedSuppliers, selectedCategories]
  );

  const [sortConfig, setSortConfig] = useState<{
    key:
      | 'sku'
      | 'name'
      | 'category'
      | 'costPrice'
      | 'marginPct'
      | 'cashPrice'
      | 'cardListPrice'
      | null;
    direction: 'asc' | 'desc';
  }>({
    key: null,
    direction: 'asc',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, scopeType, selectedSuppliers, selectedCategories, activeListId]);

  const handleSortCol = (
    key:
      | 'sku'
      | 'name'
      | 'category'
      | 'costPrice'
      | 'marginPct'
      | 'cashPrice'
      | 'cardListPrice'
  ) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key: null, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const visibleTableProducts = useMemo(() => {
    const filtered = matchingScopeProducts.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplierName || '').toLowerCase().includes(q)
      );
    });

    if (!sortConfig.key) return filtered;

    return [...filtered].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const key = sortConfig.key!;
      if (key === 'costPrice') {
        const cA = parseFloat(String(a.costPrice || '0')) || 0;
        const cB = parseFloat(String(b.costPrice || '0')) || 0;
        return (cA - cB) * dir;
      }
      if (key === 'marginPct') {
        const mA = Number(a.retailMarginPct ?? 45);
        const mB = Number(b.retailMarginPct ?? 45);
        return (mA - mB) * dir;
      }
      if (key === 'cashPrice' || key === 'cardListPrice') {
        const pA = parseFloat(String(a.salePrice || '0')) || 0;
        const pB = parseFloat(String(b.salePrice || '0')) || 0;
        return (pA - pB) * dir;
      }
      const strA = String((a as any)[key] || '');
      const strB = String((b as any)[key] || '');
      return (
        strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' }) *
        dir
      );
    });
  }, [matchingScopeProducts, searchQuery, sortConfig]);

  const {
    paginatedItems: paginatedTableProducts,
    safePage: safePricePage,
  } = useMemo(
    () => paginateArray(visibleTableProducts, currentPage, pageSize),
    [visibleTableProducts, currentPage, pageSize]
  );

  // Guardar la configuración de la regla actual
  const handleSaveCurrentRuleConfig = () => {
    const nowLabel = new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const updatedLists = priceLists.map((list) =>
      list.id === activeListId
        ? {
            ...list,
            name: editingRuleName.trim() || list.name,
            channelType,
            scopeType,
            selectedSuppliers,
            selectedCategories,
            supplierDiscountPct: parsedSupplierDiscount,
            profitMarginPct: parsedProfitMargin,
            surchargePct: parsedSurcharge,
            autoRecalculateOnCostUpdate: autoRecalculate,
            updatedAt: `Guardada ${nowLabel}`,
          }
        : list
    );

    setPriceLists(saveCustomPriceLists(updatedLists));
    onProductsUpdated(
      products,
      `Regla de lista "${editingRuleName || activeList?.name}" guardada (${
        autoRecalculate
          ? 'Recálculo automático activado al actualizar costos de proveedor'
          : 'Modo manual'
      }).`
    );
  };

  // Crear una nueva Lista de Precios personalizada
  const handleCreateCustomPriceList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListForm.name.trim()) return;

    const newRule: CustomPriceListRule = {
      id: `lista-${Date.now()}`,
      name: newListForm.name.trim(),
      channelType: newListForm.channelType,
      scopeType: 'all',
      selectedSuppliers: [],
      selectedCategories: [],
      supplierDiscountPct:
        parseFloat(newListForm.supplierDiscountPct.replace(',', '.')) || 0,
      profitMarginPct:
        parseFloat(newListForm.profitMarginPct.replace(',', '.')) || 45,
      surchargePct:
        parseFloat(newListForm.surchargePct.replace(',', '.')) || 0,
      autoRecalculateOnCostUpdate: true,
      updatedAt: 'Recién creada',
    };

    const nextLists = [...priceLists, newRule];
    setPriceLists(saveCustomPriceLists(nextLists));
    setActiveListId(newRule.id);
    setNewListModalOpen(false);
    setNewListForm({
      name: '',
      channelType: 'Tarjeta / Cuotas',
      supplierDiscountPct: '0',
      profitMarginPct: '45',
      surchargePct: '15',
    });
    onProductsUpdated(
      products,
      `Nueva lista de precios "${newRule.name}" (${newRule.channelType}) creada y seleccionada.`
    );
  };

  const handleDeleteCustomPriceList = (idToDelete: string) => {
    if (priceLists.length <= 1) return;
    const target = priceLists.find((l) => l.id === idToDelete);
    const nextLists = priceLists.filter((l) => l.id !== idToDelete);
    setPriceLists(saveCustomPriceLists(nextLists));
    if (activeListId === idToDelete) {
      setActiveListId(nextLists[0].id);
    }
    if (target) {
      onProductsUpdated(
        products,
        `Lista de precios "${target.name}" eliminada.`
      );
    }
  };

  // 4. Botón "Calcular y Aplicar Actualización Masiva"
  const handleApplyMassivePriceUpdate = async () => {
    if (matchingScopeProducts.length === 0) return;
    setIsApplyingBulk(true);

    try {
      // Primero guardamos la regla en la lista activa
      const nowLabel = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const updatedLists = priceLists.map((list) =>
        list.id === activeListId
          ? {
              ...list,
              name: editingRuleName.trim() || list.name,
              channelType,
              scopeType,
              selectedSuppliers,
              selectedCategories,
              supplierDiscountPct: parsedSupplierDiscount,
              profitMarginPct: parsedProfitMargin,
              surchargePct: parsedSurcharge,
              autoRecalculateOnCostUpdate: autoRecalculate,
              updatedAt: `Aplicada ${nowLabel}`,
            }
          : list
      );
      setPriceLists(saveCustomPriceLists(updatedLists));

      let currentMetaMap = loadProductExtendedMetaMap();
      const targetIds = new Set(matchingScopeProducts.map((p) => p.id));

      // Preparar los ítems para actualizar en lote
      const bulkItemsToUpdate: any[] = [];
      const updatedProductsLocal = products.map((rawProd) => {
        if (!targetIds.has(rawProd.id)) {
          return enrichProductWithExtendedMeta(rawProd, currentMetaMap);
        }

        const prod = enrichProductWithExtendedMeta(rawProd, currentMetaMap);
        const contentQty = Math.max(0.0001, prod.unitsPerPackage || 1);
        const rawBulkCost = parseFloat(String(prod.costPrice || '0')) || 0;

        // Aplicar Descuento de Proveedor (%) sobre el costo de lista del bulto
        const netBulkCost =
          rawBulkCost * (1 - parsedSupplierDiscount / 100);
        const netUnitCost = calculateUnitFractionalCost(netBulkCost, contentQty);

        // Aplicar Margen de Ganancia (%) sobre el costo neto unitario
        const newCashSalePrice = netUnitCost * (1 + parsedProfitMargin / 100);

        // Si la lista tiene un recargo adicional y el usuario está aplicando esa lista como precio de referencia
        const effectiveMarginWithDiscount =
          parsedProfitMargin;

        currentMetaMap = saveProductExtendedMeta(prod.id, {
          unitFractionalCost: Number(netUnitCost.toFixed(2)),
          retailMarginPct: Number(effectiveMarginWithDiscount.toFixed(2)),
        });

        const updatedProd: ProductItem = {
          ...prod,
          costPrice: netBulkCost.toFixed(2),
          salePrice: newCashSalePrice.toFixed(2),
          unitFractionalCost: Number(netUnitCost.toFixed(2)),
          retailMarginPct: Number(effectiveMarginWithDiscount.toFixed(2)),
        };

        bulkItemsToUpdate.push({
          sku: updatedProd.sku,
          name: updatedProd.name,
          category: updatedProd.category,
          brand: updatedProd.brand,
          supplierName: updatedProd.supplierName,
          costPrice: updatedProd.costPrice,
          ivaRate: updatedProd.ivaRate || '21.00',
          salePrice: updatedProd.salePrice,
          trackStock: updatedProd.trackStock !== false,
          stock: updatedProd.stock,
          minStock: updatedProd.minStock,
          status: updatedProd.status || 'Activo',
        });

        return enrichProductWithExtendedMeta(updatedProd, currentMetaMap);
      });

      // Persistir en la base de datos vía /api/products/bulk
      if (bulkItemsToUpdate.length > 0) {
        const res = await fetch('/api/products/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: bulkItemsToUpdate }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.products)) {
            const enrichedFromServer = data.products.map((p: ProductItem) =>
              enrichProductWithExtendedMeta(p, currentMetaMap)
            );
            onProductsUpdated(
              enrichedFromServer,
              `Actualización masiva aplicada en ${bulkItemsToUpdate.length} productos (${
                editingRuleName || activeList?.name
              }): Dto. Prov. ${parsedSupplierDiscount}% · Margen +${parsedProfitMargin}% · Recargo +${parsedSurcharge}%.`
            );
            return;
          }
        }
      }

      onProductsUpdated(
        updatedProductsLocal,
        `Actualización masiva aplicada en ${matchingScopeProducts.length} productos (${
          editingRuleName || activeList?.name
        }): Dto. Prov. ${parsedSupplierDiscount}% · Margen +${parsedProfitMargin}% · Recargo +${parsedSurcharge}%.`
      );
    } catch (err) {
      console.error('Error applying massive price update:', err);
    } finally {
      setIsApplyingBulk(false);
    }
  };

  // Edición Rápida (Inline) en la propia tabla de Precios
  const handleInlineFieldChange = (
    prod: ProductItem,
    field: 'unitCost' | 'marginPct' | 'cashPrice' | 'cardListPrice',
    rawValue: string
  ) => {
    const currentDraft = inlinePriceDrafts[prod.id] || {
      unitCost: '0.00',
      marginPct: '45.00',
      cashPrice: '0.00',
      cardListPrice: '0.00',
    };

    const numVal = parseFloat(rawValue.replace(',', '.'));
    const validNum = Number.isFinite(numVal) && numVal >= 0 ? numVal : 0;

    if (field === 'unitCost') {
      const margin = parseFloat(currentDraft.marginPct) || 0;
      const nextCash = validNum * (1 + margin / 100);
      const nextCard = nextCash * (1 + effectiveCardSurchargePct / 100);
      setInlinePriceDrafts((prev) => ({
        ...prev,
        [prod.id]: {
          unitCost: rawValue,
          marginPct: currentDraft.marginPct,
          cashPrice: nextCash.toFixed(2),
          cardListPrice: nextCard.toFixed(2),
        },
      }));
    } else if (field === 'marginPct') {
      const unitCost = parseFloat(currentDraft.unitCost) || 0;
      const nextCash = unitCost * (1 + validNum / 100);
      const nextCard = nextCash * (1 + effectiveCardSurchargePct / 100);
      setInlinePriceDrafts((prev) => ({
        ...prev,
        [prod.id]: {
          ...currentDraft,
          marginPct: rawValue,
          cashPrice: nextCash.toFixed(2),
          cardListPrice: nextCard.toFixed(2),
        },
      }));
    } else if (field === 'cashPrice') {
      const unitCost = parseFloat(currentDraft.unitCost) || 0;
      const nextMargin =
        unitCost > 0 ? ((validNum / unitCost - 1) * 100).toFixed(2) : '0.00';
      const nextCard = validNum * (1 + effectiveCardSurchargePct / 100);
      setInlinePriceDrafts((prev) => ({
        ...prev,
        [prod.id]: {
          ...currentDraft,
          cashPrice: rawValue,
          marginPct: nextMargin,
          cardListPrice: nextCard.toFixed(2),
        },
      }));
    } else if (field === 'cardListPrice') {
      const divisor = 1 + effectiveCardSurchargePct / 100;
      const nextCash = divisor > 0 ? validNum / divisor : validNum;
      const unitCost = parseFloat(currentDraft.unitCost) || 0;
      const nextMargin =
        unitCost > 0 ? ((nextCash / unitCost - 1) * 100).toFixed(2) : '0.00';
      setInlinePriceDrafts((prev) => ({
        ...prev,
        [prod.id]: {
          ...currentDraft,
          cardListPrice: rawValue,
          cashPrice: nextCash.toFixed(2),
          marginPct: nextMargin,
        },
      }));
    }
  };

  // Guardar cambio rápido de una fila al salir del input o presionar Enter / botón Guardar
  const handleCommitInlinePriceRow = async (prod: ProductItem) => {
    const draft = inlinePriceDrafts[prod.id];
    if (!draft) return;

    const enriched = enrichProductWithExtendedMeta(prod);
    const contentQty = Math.max(0.0001, enriched.unitsPerPackage || 1);
    const newUnitCost = Math.max(0, parseFloat(draft.unitCost) || 0);
    const newBulkCost = newUnitCost * contentQty;
    const newMargin = parseFloat(draft.marginPct) || 0;
    const newCashSale = Math.max(0, parseFloat(draft.cashPrice) || 0);

    setSavingRowId(prod.id);
    try {
      const updatedMetaMap = saveProductExtendedMeta(prod.id, {
        unitFractionalCost: Number(newUnitCost.toFixed(2)),
        retailMarginPct: Number(newMargin.toFixed(2)),
      });

      const res = await fetch(`/api/products/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: enriched.sku,
          name: enriched.name,
          category: enriched.category,
          brand: enriched.brand,
          supplierName: enriched.supplierName,
          costPrice: newBulkCost.toFixed(2),
          ivaRate: enriched.ivaRate || '21.00',
          salePrice: newCashSale.toFixed(2),
          trackStock: enriched.trackStock !== false,
          stock: enriched.stock,
          minStock: enriched.minStock,
          status: enriched.status || 'Activo',
        }),
      });

      let nextProducts = products.map((p) =>
        p.id === prod.id
          ? enrichProductWithExtendedMeta(
              {
                ...p,
                costPrice: newBulkCost.toFixed(2),
                salePrice: newCashSale.toFixed(2),
              },
              updatedMetaMap
            )
          : enrichProductWithExtendedMeta(p, updatedMetaMap)
      );

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          nextProducts = data.products.map((p: ProductItem) =>
            enrichProductWithExtendedMeta(p, updatedMetaMap)
          );
        }
      }

      onProductsUpdated(
        nextProducts,
        `Precio actualizado en línea para ${prod.sku}: Costo ${formatCurrency(
          newUnitCost
        )} · Margen ${newMargin.toFixed(1)}% · Contado ${formatCurrency(
          newCashSale
        )}`
      );
    } catch (err) {
      console.error('Error saving inline price row:', err);
    } finally {
      setSavingRowId(null);
    }
  };

  const getChannelIcon = (type: PriceListChannelType) => {
    switch (type) {
      case 'Efectivo / Contado':
        return Wallet;
      case 'Tarjeta / Cuotas':
        return CreditCard;
      case 'Cuenta Corriente':
        return Building2;
      case 'Mayorista / Gremio':
        return Users;
      case 'Cliente VIP':
        return Crown;
      default:
        return Tag;
    }
  };

  // Ejemplo en vivo para mostrar la fórmula con $10.000 de costo base
  const exampleCalc = calculateFormulaPrices(
    10000,
    parsedSupplierDiscount,
    parsedProfitMargin,
    parsedSurcharge
  );

  return (
    <div className="space-y-6">
      {/* SECCIÓN SUPERIOR: GESTIÓN DE LISTAS DE PRECIOS Y REGLAS DE ACTUALIZACIÓN MASIVA */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {/* Cabecera del Módulo */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                Listas de Precios Personalizadas y Actualización Masiva
              </h2>
              <p className="text-xs text-slate-300">
                Cree múltiples listas (Efectivo, Cuenta Corriente, Tarjeta, Mayorista, VIP) y aplique descuentos de proveedor, márgenes y recargos en lote.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenBulkImport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF6600]" />
              <span>Importar Costos de Proveedor (Excel/CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => setNewListModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Lista de Precios</span>
            </button>
          </div>
        </div>

        {/* 1. Selector de Listas de Precios Creadas (Tarjetas Interactivas) */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Seleccione o Gestione una Lista de Precios Activa ({priceLists.length} listas configuradas)
            </span>
            <span className="text-xs text-slate-500">
              Haga clic en una lista para editar su fórmula o aplicarla masivamente
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {priceLists.map((list) => {
              const IconComp = getChannelIcon(list.channelType);
              const isSelected = list.id === activeListId;
              return (
                <div
                  key={list.id}
                  onClick={() => setActiveListId(list.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-white border-2 border-[#FF6600] shadow-sm ring-2 ring-[#FF6600]/15'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#FF6600] text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {list.channelType}
                      </span>
                    </div>

                    {priceLists.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomPriceList(list.id);
                        }}
                        title="Eliminar lista"
                        className="text-slate-300 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                      {list.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 font-mono text-[10px]">
                      {list.supplierDiscountPct > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                          Dto. -{list.supplierDiscountPct}%
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        Margen +{list.profitMarginPct}%
                      </span>
                      {list.surchargePct > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                          Recargo +{list.surchargePct}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{list.updatedAt}</span>
                    {list.autoRecalculateOnCostUpdate && (
                      <span
                        title="Se recalcula automáticamente al actualizar costos de proveedor"
                        className="text-emerald-600 font-semibold flex items-center gap-0.5"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        Auto
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2 y 3. Panel de Configuración de Regla: Filtros de Selección + Fórmula de Cálculo */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Columna Izquierda (5 cols): Datos de Lista + 2. Filtros de Selección (A qué productos aplica) */}
          <div className="lg:col-span-5 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#FF6600]" />
                <span>2. Configuración de Lista y Filtros de Selección</span>
              </h3>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                Aplica a {matchingScopeProducts.length} de {products.length} art.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nombre de la Lista *
                </label>
                <input
                  type="text"
                  value={editingRuleName}
                  onChange={(e) => setEditingRuleName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tipo de Lista / Canal *
                </label>
                <select
                  value={channelType}
                  onChange={(e) =>
                    setChannelType(e.target.value as PriceListChannelType)
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Efectivo / Contado">Efectivo / Contado</option>
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                  <option value="Tarjeta / Cuotas">Tarjeta / Cuotas</option>
                  <option value="Mayorista / Gremio">Mayorista / Gremio</option>
                  <option value="Cliente VIP">Cliente VIP</option>
                </select>
              </div>
            </div>

            {/* Selector de Alcance: Todos los productos | Por Proveedores | Por Categorías */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                ¿A qué productos aplica esta lista / regla de cálculo?
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScopeType('all')}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    scopeType === 'all'
                      ? 'bg-[#FF6600] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Todos ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScopeType('suppliers')}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    scopeType === 'suppliers'
                      ? 'bg-[#FF6600] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Por Proveedores
                </button>
                <button
                  type="button"
                  onClick={() => setScopeType('categories')}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    scopeType === 'categories'
                      ? 'bg-[#FF6600] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Por Categorías
                </button>
              </div>
            </div>

            {/* Multi-selección de Proveedores */}
            {scopeType === 'suppliers' && (
              <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span>
                      Seleccione uno, varios o todos los Proveedores ({selectedSuppliers.length})
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers(allSupplierNames)}
                      className="text-[#FF6600] font-semibold hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers([])}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                  {allSupplierNames.map((supName) => {
                    const checked = selectedSuppliers.includes(supName);
                    return (
                      <label
                        key={supName}
                        className="flex items-center justify-between py-1.5 px-1 text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="truncate pr-2 font-medium text-slate-800">
                          {supName}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSuppliers((prev) => [...prev, supName]);
                            } else {
                              setSelectedSuppliers((prev) =>
                                prev.filter((s) => s !== supName)
                              );
                            }
                          }}
                          className="w-3.5 h-3.5 accent-[#FF6600] rounded cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Multi-selección de Categorías / Rubros */}
            {scopeType === 'categories' && (
              <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span>
                      Seleccione Categorías o Rubros específicos ({selectedCategories.length})
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(allCategories)}
                      className="text-[#FF6600] font-semibold hover:underline cursor-pointer"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([])}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                  {allCategories.map((cat) => {
                    const checked = selectedCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        className="flex items-center justify-between py-1.5 px-1 text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="truncate pr-2 font-medium text-slate-800">
                          {cat}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories((prev) => [...prev, cat]);
                            } else {
                              setSelectedCategories((prev) =>
                                prev.filter((c) => c !== cat)
                              );
                            }
                          }}
                          className="w-3.5 h-3.5 accent-[#FF6600] rounded cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Switch de Auto-recálculo al actualizar costos de proveedor */}
            <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Recalcular automáticamente al actualizar costos
                </span>
                <span className="text-[11px] text-slate-500">
                  Mantiene la regla vinculada cuando cambian los precios de lista del proveedor.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoRecalculate}
                onClick={() => setAutoRecalculate((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  autoRecalculate ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
                    autoRecalculate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Columna Derecha (7 cols): 3. Fórmula de Cálculo de Precios + 4. Aplicación y Actualización Masiva */}
          <div className="lg:col-span-7 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-[#FF6600]" />
                    <span>
                      3. Fórmula de Cálculo de Precios (Descuentos, Margen y Recargos)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Aplique en orden o simultáneamente Descuento de Proveedor, Margen de Ganancia y Recargo Adicional.
                  </p>
                </div>
              </div>

              {/* Los 3 Parámetros de la Fórmula */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Paso 1: Descuento de Proveedor (%) */}
                <div className="p-3.5 rounded-xl bg-white border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                      1. Dto. Proveedor (%)
                    </span>
                    <span className="text-[10px] font-mono text-sky-600 font-semibold">
                      S/Costo Lista
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      step="0.5"
                      value={supplierDiscountPct}
                      onChange={(e) => setSupplierDiscountPct(e.target.value)}
                      className="w-full pl-3 pr-7 py-2 text-base font-mono font-extrabold text-sky-900 bg-sky-50/50 border border-sky-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-sky-700">
                      %
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 5, 10, 15, 20].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSupplierDiscountPct(String(val))}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
                          parsedSupplierDiscount === val
                            ? 'bg-sky-700 text-white border-sky-700'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        -{val}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paso 2: Margen de Ganancia (%) */}
                <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      2. Margen Ganancia (%)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                      S/Costo Neto
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={profitMarginPct}
                      onChange={(e) => setProfitMarginPct(e.target.value)}
                      className="w-full pl-3 pr-7 py-2 text-base font-mono font-extrabold text-emerald-900 bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-emerald-700">
                      %
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[30, 40, 45, 50, 60, 80].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setProfitMarginPct(String(val))}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
                          Math.round(parsedProfitMargin) === val
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        +{val}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paso 3: Recargo / Adicional (%) */}
                <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      3. Recargo / Adicional (%)
                    </span>
                    <span className="text-[10px] font-mono text-amber-700 font-semibold">
                      Tarjeta / Cta.Cte.
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={surchargePct}
                      onChange={(e) => setSurchargePct(e.target.value)}
                      className="w-full pl-3 pr-7 py-2 text-base font-mono font-extrabold text-amber-900 bg-amber-50/50 border border-amber-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-amber-800">
                      %
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 10, 12, 15, 18, 25].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSurchargePct(String(val))}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
                          Math.round(parsedSurcharge) === val
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        +{val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulador de Fórmula en Tiempo Real */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700">
                  Simulación (Ej. Costo Lista $10.000):
                </span>
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <span className="px-2 py-1 rounded bg-sky-50 text-sky-800 border border-sky-200">
                    Costo Neto: <strong>{formatCurrency(exampleCalc.netCostAfterDiscount)}</strong>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Venta Contado: <strong>{formatCurrency(exampleCalc.cashSalePrice)}</strong>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="px-2 py-1 rounded bg-orange-50 text-[#FF6600] border border-orange-200 font-bold">
                    Precio Final Lista: {formatCurrency(exampleCalc.finalListPriceWithSurcharge)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Botones de Guardado de Regla y "Calcular y Aplicar Actualización Masiva" */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button
                type="button"
                onClick={handleSaveCurrentRuleConfig}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-600" />
                <span>Guardar Regla de Lista</span>
              </button>

              <button
                type="button"
                disabled={isApplyingBulk || matchingScopeProducts.length === 0}
                onClick={handleApplyMassivePriceUpdate}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  {isApplyingBulk
                    ? 'Calculando y Aplicando en Lote...'
                    : `Calcular y Aplicar Actualización Masiva (${matchingScopeProducts.length} prod.)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: TABLA DE PRECIOS PERSONALIZADA CON EDICIÓN RÁPIDA EN LÍNEA */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-visible">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Tabla de Precios por Canal y Edición Rápida en Línea
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-orange-50 text-[#FF6600] border border-orange-200 text-xs font-bold">
                Lista Activa: {editingRuleName || activeList?.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Edite directamente el Costo, Margen de Ganancia % o Precio de Venta en la tabla y presione Enter o el botón de confirmación para guardar sin abrir diálogos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Buscador rápido */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar código, producto, rubro..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white"
              />
            </div>

            {/* Selector de Columnas Visibles */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnsMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Columns3 className="w-4 h-4 text-slate-500" />
                <span>
                  Columnas (
                  {Object.values(visibleColumns).filter(Boolean).length}/
                  {PRICE_TABLE_COLUMNS.length})
                </span>
              </button>

              {columnsMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-40">
                  <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Columnas Relevantes de Precios
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleColumns({
                          sku: true,
                          name: true,
                          category: true,
                          costPrice: true,
                          marginPct: true,
                          cashPrice: true,
                          cardListPrice: true,
                        })
                      }
                      className="text-[11px] font-semibold text-[#FF6600] hover:underline cursor-pointer"
                    >
                      Restaurar
                    </button>
                  </div>
                  <div className="py-1">
                    {PRICE_TABLE_COLUMNS.map((col) => {
                      const checked = visibleColumns[col.key];
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() =>
                            setVisibleColumns((prev) => ({
                              ...prev,
                              [col.key]: !prev[col.key],
                            }))
                          }
                          className="w-full px-3.5 py-2 text-left flex items-center justify-between text-xs hover:bg-slate-50 cursor-pointer"
                        >
                          <span
                            className={
                              checked
                                ? 'font-semibold text-slate-900'
                                : 'text-slate-500'
                            }
                          >
                            {col.label}
                          </span>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              checked
                                ? 'bg-[#FF6600] border-[#FF6600] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla con solo los campos relevantes de precios y edición rápida inline */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 select-none">
                {visibleColumns.sku && (
                  <th
                    onClick={() => handleSortCol('sku')}
                    className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Código</span>
                      {sortConfig.key === 'sku' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.name && (
                  <th
                    onClick={() => handleSortCol('name')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Nombre / Producto</span>
                      {sortConfig.key === 'name' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.category && (
                  <th
                    onClick={() => handleSortCol('category')}
                    className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Categoría</span>
                      {sortConfig.key === 'category' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.costPrice && (
                  <th
                    onClick={() => handleSortCol('costPrice')}
                    className="py-3 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Precio de Costo</span>
                      {sortConfig.key === 'costPrice' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.marginPct && (
                  <th
                    onClick={() => handleSortCol('marginPct')}
                    className="py-3 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Margen de Ganancia %</span>
                      {sortConfig.key === 'marginPct' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.cashPrice && (
                  <th
                    onClick={() => handleSortCol('cashPrice')}
                    className="py-3 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Precio de Venta (Contado / Efectivo)</span>
                      {sortConfig.key === 'cashPrice' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.cardListPrice && (
                  <th
                    onClick={() => handleSortCol('cardListPrice')}
                    className="py-3 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 hover:text-slate-900"
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>
                        Precio Lista / Tarjeta (+{effectiveCardSurchargePct}%)
                      </span>
                      {sortConfig.key === 'cardListPrice' ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#FF6600]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#FF6600]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {visibleTableProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-slate-500 text-xs"
                  >
                    No hay productos que coincidan con el filtro de proveedores/categorías o búsqueda actual.
                  </td>
                </tr>
              ) : (
                paginatedTableProducts.map((rawProd) => {
                  const prod = enrichProductWithExtendedMeta(rawProd);
                  const singularUnit = getSingularContentTypeLabel(
                    prod.contentType
                  );
                  const unitCost =
                    prod.unitFractionalCost ??
                    calculateUnitFractionalCost(
                      prod.costPrice,
                      prod.unitsPerPackage || 1
                    );
                  const draft = inlinePriceDrafts[prod.id] || {
                    unitCost: unitCost.toFixed(2),
                    marginPct: String(prod.retailMarginPct ?? 45),
                    cashPrice: String(prod.salePrice || '0.00'),
                    cardListPrice: (
                      (parseFloat(String(prod.salePrice || '0')) || 0) *
                      (1 + effectiveCardSurchargePct / 100)
                    ).toFixed(2),
                  };

                  // Previsualización en vivo según la fórmula del panel superior
                  const formulaSim = calculateFormulaPrices(
                    parseFloat(draft.unitCost) || unitCost,
                    parsedSupplierDiscount,
                    parsedProfitMargin,
                    parsedSurcharge
                  );

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      {/* 1. Código */}
                      {visibleColumns.sku && (
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {prod.sku}
                        </td>
                      )}

                      {/* 2. Nombre / Producto */}
                      {visibleColumns.name && (
                        <td className="py-3 px-4 font-medium text-slate-900 min-w-[220px]">
                          <div>
                            {prod.name
                              .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
                              .trim()}
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>{prod.supplierName}</span>
                            <span>·</span>
                            <span className="font-mono text-slate-600">
                              1 {prod.purchaseUnit || 'CAJA'} ={' '}
                              {prod.unitsPerPackage || 1}{' '}
                              {prod.contentType || 'Unidades'}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 3. Categoría */}
                      {visibleColumns.category && (
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            {prod.category}
                          </span>
                        </td>
                      )}

                      {/* 4. Precio de Costo (Editable en línea) */}
                      {visibleColumns.costPrice && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-mono text-slate-400">
                                $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={draft.unitCost}
                                onChange={(e) =>
                                  handleInlineFieldChange(
                                    prod,
                                    'unitCost',
                                    e.target.value
                                  )
                                }
                                onBlur={() => handleCommitInlinePriceRow(prod)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-24 px-2 py-1 text-xs font-mono tabular-nums font-bold text-right rounded border border-slate-200 bg-white focus:outline-none focus:border-[#FF6600]"
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              Costo por {singularUnit} (Bulto:{' '}
                              {formatCurrency(prod.costPrice)})
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 5. Margen de Ganancia % (Editable en línea) */}
                      {visibleColumns.marginPct && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                value={draft.marginPct}
                                onChange={(e) =>
                                  handleInlineFieldChange(
                                    prod,
                                    'marginPct',
                                    e.target.value
                                  )
                                }
                                onBlur={() => handleCommitInlinePriceRow(prod)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-20 px-2 py-1 text-xs font-mono tabular-nums font-bold text-right text-emerald-800 rounded border border-emerald-300 bg-emerald-50/40 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                              />
                              <span className="text-xs font-mono font-bold text-emerald-700">
                                %
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Editable en línea
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 6. Precio de Venta (Contado / Efectivo) (Editable en línea) */}
                      {visibleColumns.cashPrice && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono font-bold text-slate-500">
                                $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={draft.cashPrice}
                                onChange={(e) =>
                                  handleInlineFieldChange(
                                    prod,
                                    'cashPrice',
                                    e.target.value
                                  )
                                }
                                onBlur={() => handleCommitInlinePriceRow(prod)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-28 px-2.5 py-1 text-xs sm:text-sm font-mono tabular-nums font-extrabold text-right text-slate-900 rounded border-2 border-slate-300 bg-white focus:outline-none focus:border-[#FF6600]"
                              />
                            </div>
                            <span className="text-[10px] font-mono text-emerald-700">
                              Por {singularUnit} · Fórmula:{' '}
                              {formatCurrency(formulaSim.cashSalePrice)}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 7. Precio Lista / Tarjeta (Editable en línea y calculado con recargo de lista) */}
                      {visibleColumns.cardListPrice && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-[#FF6600]">
                                $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={draft.cardListPrice}
                                onChange={(e) =>
                                  handleInlineFieldChange(
                                    prod,
                                    'cardListPrice',
                                    e.target.value
                                  )
                                }
                                onBlur={() => handleCommitInlinePriceRow(prod)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-28 px-2.5 py-1 text-xs sm:text-sm font-mono tabular-nums font-extrabold text-right text-[#FF6600] rounded border border-orange-300 bg-orange-50/40 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                              />
                              <button
                                type="button"
                                onClick={() => handleCommitInlinePriceRow(prod)}
                                disabled={savingRowId === prod.id}
                                title="Guardar cambios de esta fila"
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-[#FF6600] text-white transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              {activeList?.channelType}:{' '}
                              <strong>
                                {formatCurrency(
                                  formulaSim.finalListPriceWithSurcharge
                                )}
                              </strong>
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePaginationBar
          totalItems={visibleTableProducts.length}
          currentPage={safePricePage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setCurrentPage(1);
          }}
          itemLabel="productos"
        />
      </div>

      {/* Modal para Crear Nueva Lista de Precios Personalizada */}
      {newListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF6600] text-white flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Crear Nueva Lista de Precios
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina canal, descuento, margen y recargo inicial
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateCustomPriceList} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la Lista Personalizada *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Tarjeta 6 Cuotas, Cuenta Corriente 60 Días, Cliente VIP..."
                  value={newListForm.name}
                  onChange={(e) =>
                    setNewListForm({ ...newListForm, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Lista / Canal Comercial *
                </label>
                <select
                  value={newListForm.channelType}
                  onChange={(e) =>
                    setNewListForm({
                      ...newListForm,
                      channelType: e.target.value as PriceListChannelType,
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm font-semibold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="Efectivo / Contado">Efectivo / Contado</option>
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                  <option value="Tarjeta / Cuotas">Tarjeta / Cuotas</option>
                  <option value="Mayorista / Gremio">Mayorista / Gremio</option>
                  <option value="Cliente VIP">Cliente VIP</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Dto. Proveedor %
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newListForm.supplierDiscountPct}
                    onChange={(e) =>
                      setNewListForm({
                        ...newListForm,
                        supplierDiscountPct: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-sm font-mono font-bold border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Margen Ganancia %
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newListForm.profitMarginPct}
                    onChange={(e) =>
                      setNewListForm({
                        ...newListForm,
                        profitMarginPct: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-sm font-mono font-bold border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Recargo Adic. %
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newListForm.surchargePct}
                    onChange={(e) =>
                      setNewListForm({
                        ...newListForm,
                        surchargePct: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-sm font-mono font-bold border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewListModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold cursor-pointer"
                >
                  Crear Lista de Precios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
