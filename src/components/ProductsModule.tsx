import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  X,
  Columns3,
  Wand2,
  Check,
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  ScanBarcode,
  AlertCircle,
  Trash2,
  Pencil,
  Layers,
  Tag,
  Boxes,
  Calculator,
  Percent,
  PackageCheck,
  History,
  ArrowDownLeft,
  Eye,
  EyeOff,
  ShoppingCart,
} from 'lucide-react';
import {
  ProductItem,
  SupplierItem,
  BulkContentType,
} from '../types/ferreteria.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { BarcodePrintModal } from './BarcodePrintModal.tsx';
import {
  TablePaginationBar,
  PageSizeOption,
  paginateArray,
} from './TablePaginationBar.tsx';
import { getProductsInSupplierCartsLookup } from '../lib/supplierCartsStorage.ts';

const PRODUCT_EXTENDED_META_KEY = 'ferreteria_del_puente_product_meta_v1';
const STOCK_MOVEMENTS_STORAGE_KEY = 'ferreteria_del_puente_stock_movements_v1';

export interface StockMovementEntry {
  id: string;
  productId: number;
  sku: string;
  productName: string;
  supplierName: string;
  createdAt: string;
  movementType: 'ENTRADA' | 'AJUSTE POST-VENTA';
  detail: string;
  orderStatus:
    | 'Completado/Recibido'
    | 'Recepción Parcial'
    | 'Ajuste Manual Post-Venta';
  requestedQty: number;
  receivedQty: number;
  remainingPendingQty: number;
  previousStock: number;
  newStock: number;
}

export function loadStockMovements(): StockMovementEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STOCK_MOVEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendStockMovement(
  entry: StockMovementEntry
): StockMovementEntry[] {
  const current = loadStockMovements();
  const next = [entry, ...current].slice(0, 200);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        STOCK_MOVEMENTS_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

export interface ProductExtendedMeta {
  barcode?: string;
  description?: string;
  purchaseUnit?: string;
  unitsPerPackage?: number;
  contentType?: BulkContentType;
  unitFractionalCost?: number;
  retailMarginPct?: number;
  cardPrice?: string;
  associatedSuppliers?: string[];
}

export const BULK_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'CAJA', label: 'CAJA' },
  { value: 'ROLLO', label: 'ROLLO' },
  { value: 'PAQUETE', label: 'PAQUETE' },
  { value: 'BULTO', label: 'BULTO' },
  { value: 'PALLET', label: 'PALLET' },
  { value: 'ROLLE', label: 'ROLLE (Rollo)' },
  { value: 'BOBINA', label: 'BOBINA' },
  { value: 'PACK', label: 'PACK' },
  { value: 'BOLSA', label: 'BOLSA' },
  { value: 'BALDE', label: 'BALDE' },
  { value: 'BIDÓN', label: 'BIDÓN' },
  { value: 'TAMBOR', label: 'TAMBOR' },
  { value: 'ATADO', label: 'ATADO' },
  { value: 'UNIDAD', label: 'UNIDAD' },
];

export const BULK_CONTENT_TYPE_OPTIONS: {
  value: BulkContentType;
  label: string;
  singular: string;
  shortUnit: string;
}[] = [
  { value: 'Unidades', label: 'Unidades', singular: 'Unidad', shortUnit: 'u.' },
  { value: 'Metros', label: 'Metros', singular: 'Metro', shortUnit: 'm' },
  { value: 'Kilos', label: 'Kilos', singular: 'Kilo', shortUnit: 'kg' },
  { value: 'Litros', label: 'Litros', singular: 'Litro', shortUnit: 'lt' },
];

export function getSingularContentTypeLabel(
  contentType?: BulkContentType | string
): string {
  switch (contentType) {
    case 'Metros':
      return 'Metro';
    case 'Kilos':
      return 'Kilo';
    case 'Litros':
      return 'Litro';
    case 'Unidades':
    default:
      return 'Unidad';
  }
}

export function getShortContentTypeUnit(
  contentType?: BulkContentType | string
): string {
  switch (contentType) {
    case 'Metros':
      return 'm';
    case 'Kilos':
      return 'kg';
    case 'Litros':
      return 'lt';
    case 'Unidades':
    default:
      return 'u.';
  }
}

export function calculateUnitFractionalCost(
  bulkCostPrice: string | number,
  bulkContent: string | number
): number {
  const parsedBulkCost =
    typeof bulkCostPrice === 'number'
      ? bulkCostPrice
      : parseFloat(String(bulkCostPrice || '0').replace(',', '.'));
  const parsedContent =
    typeof bulkContent === 'number'
      ? bulkContent
      : parseFloat(String(bulkContent || '1').replace(',', '.'));

  const validBulkCost =
    Number.isFinite(parsedBulkCost) && parsedBulkCost >= 0 ? parsedBulkCost : 0;
  const validContent =
    Number.isFinite(parsedContent) && parsedContent > 0 ? parsedContent : 1;

  return validBulkCost / validContent;
}

export function inferDefaultBulkPackaging(prod: {
  name?: string;
  category?: string;
  purchaseUnit?: string;
  unitsPerPackage?: number;
  contentType?: BulkContentType;
}): {
  purchaseUnit: string;
  unitsPerPackage: number;
  contentType: BulkContentType;
} {
  const text = `${prod.name || ''} ${prod.category || ''}`.toLowerCase();
  let defaultUnit = prod.purchaseUnit || 'CAJA';
  let defaultContentType: BulkContentType = prod.contentType || 'Unidades';
  const defaultQty =
    prod.unitsPerPackage && prod.unitsPerPackage > 0 ? prod.unitsPerPackage : 1;

  if (!prod.purchaseUnit) {
    if (text.includes('cable') || text.includes('manguera') || text.includes('soga') || text.includes('cadena')) {
      defaultUnit = 'ROLLO';
      defaultContentType = 'Metros';
    } else if (text.includes('alambre') || text.includes('tanza')) {
      defaultUnit = 'BOBINA';
      defaultContentType = 'Metros';
    } else if (text.includes('cemento') || text.includes('electrodo') || text.includes('clavo') || text.includes('alambre recocido')) {
      defaultUnit = 'BOLSA';
      defaultContentType = 'Kilos';
    } else if (text.includes('látex') || text.includes('latex') || text.includes('pintura') || text.includes('impermeabilizante') || text.includes('diluyente')) {
      defaultUnit = 'BALDE';
      defaultContentType = 'Litros';
    } else if (text.includes('juego') || text.includes('set') || text.includes('blister')) {
      defaultUnit = 'PAQUETE';
      defaultContentType = 'Unidades';
    } else {
      defaultUnit = 'CAJA';
      defaultContentType = 'Unidades';
    }
  } else {
    const upper = prod.purchaseUnit.toUpperCase();
    if (upper === 'ROLLO') defaultUnit = 'ROLLO';
    else if (upper.includes('ROLLE')) defaultUnit = 'ROLLE';
    else if (upper.includes('PAQUETE')) defaultUnit = 'PAQUETE';
    else if (upper.includes('BULTO')) defaultUnit = 'BULTO';
    else if (upper.includes('PALLET')) defaultUnit = 'PALLET';
    else if (upper.includes('BOBINA')) defaultUnit = 'BOBINA';
    else if (upper.includes('PACK')) defaultUnit = 'PACK';
    else if (upper.includes('BOLSA')) defaultUnit = 'BOLSA';
    else if (upper.includes('BALDE')) defaultUnit = 'BALDE';
    else if (upper.includes('BID')) defaultUnit = 'BIDÓN';
    else if (upper.includes('TAMBOR')) defaultUnit = 'TAMBOR';
    else if (upper.includes('ATADO')) defaultUnit = 'ATADO';
    else if (upper.includes('UNIDAD')) defaultUnit = 'UNIDAD';
    else defaultUnit = 'CAJA';
  }

  return {
    purchaseUnit: defaultUnit,
    unitsPerPackage: defaultQty,
    contentType: defaultContentType,
  };
}

export function loadProductExtendedMetaMap(): Record<number, ProductExtendedMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PRODUCT_EXTENDED_META_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveProductExtendedMeta(
  productId: number,
  meta: ProductExtendedMeta
): Record<number, ProductExtendedMeta> {
  const current = loadProductExtendedMetaMap();
  const next = {
    ...current,
    [productId]: {
      ...(current[productId] || {}),
      ...meta,
    },
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        PRODUCT_EXTENDED_META_KEY,
        JSON.stringify(next)
      );
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

export function enrichProductWithExtendedMeta(
  prod: ProductItem,
  metaMap?: Record<number, ProductExtendedMeta>
): ProductItem {
  const map = metaMap || loadProductExtendedMetaMap();
  const meta = map[prod.id] || {};
  const inferred = inferDefaultBulkPackaging({
    name: prod.name,
    category: prod.category,
    purchaseUnit: meta.purchaseUnit || prod.purchaseUnit,
    unitsPerPackage: meta.unitsPerPackage ?? prod.unitsPerPackage,
    contentType: meta.contentType || prod.contentType,
  });

  const bulkCost = parseFloat(String(prod.costPrice || '0')) || 0;
  const contentQty = Math.max(0.0001, inferred.unitsPerPackage || 1);
  const unitFractionalCost = calculateUnitFractionalCost(bulkCost, contentQty);
  const currentSale = parseFloat(String(prod.salePrice || '0')) || 0;
  const computedMargin =
    meta.retailMarginPct !== undefined
      ? meta.retailMarginPct
      : unitFractionalCost > 0
      ? Number((((currentSale / unitFractionalCost) - 1) * 100).toFixed(2))
      : 45;

  const rawCardPrice = meta.cardPrice || prod.cardPrice;
  const cardPriceVal =
    rawCardPrice && Number.isFinite(parseFloat(String(rawCardPrice)))
      ? parseFloat(String(rawCardPrice)).toFixed(2)
      : (currentSale * 1.15).toFixed(2);

  return {
    ...prod,
    ...meta,
    purchaseUnit: inferred.purchaseUnit,
    unitsPerPackage: inferred.unitsPerPackage,
    contentType: inferred.contentType,
    unitFractionalCost,
    retailMarginPct: computedMargin,
    cardPrice: cardPriceVal,
  };
}

interface ProductsModuleProps {
  products: ProductItem[];
  suppliers: SupplierItem[];
  onOpenBulkImport: () => void;
  onProductsUpdated: (newProducts: ProductItem[], message: string) => void;
  formatCurrency: (val: string | number) => string;
}

export type ProductColumnKey =
  | 'sku'
  | 'name'
  | 'category'
  | 'brand'
  | 'supplierName'
  | 'costPrice'
  | 'ivaRate'
  | 'salePrice'
  | 'trackStock'
  | 'stockUnified'
  | 'status'
  | 'barcodeLabel'
  | 'actions'
  | 'deleteAction';

interface ColumnDefinition {
  key: ProductColumnKey;
  label: string;
  align?: 'left' | 'right' | 'center';
}

const ALL_PRODUCT_COLUMNS: ColumnDefinition[] = [
  { key: 'sku', label: 'Código', align: 'left' },
  { key: 'name', label: 'Descripción', align: 'left' },
  { key: 'supplierName', label: 'Proveedor', align: 'left' },
  { key: 'category', label: 'Categoría', align: 'left' },
  { key: 'brand', label: 'Marca', align: 'left' },
  { key: 'costPrice', label: 'Precio Costo', align: 'right' },
  { key: 'ivaRate', label: 'IVA %', align: 'right' },
  { key: 'salePrice', label: 'Precio de Venta', align: 'right' },
  { key: 'trackStock', label: 'Control de Stock', align: 'center' },
  { key: 'stockUnified', label: 'Stock', align: 'left' },
  { key: 'status', label: 'Estado y Alertas', align: 'left' },
  { key: 'barcodeLabel', label: 'Etiqueta', align: 'center' },
  { key: 'actions', label: 'Acciones', align: 'center' },
  { key: 'deleteAction', label: 'Eliminar', align: 'center' },
];

export const ProductsModule: React.FC<ProductsModuleProps> = ({
  products,
  suppliers,
  onOpenBulkImport,
  onProductsUpdated,
  formatCurrency,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('Todos');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  // Requerimiento 2: Filtro Inicial por Defecto ("Activos") en lugar de "Todos"
  const [statusFilter, setStatusFilter] = useState('Activos');
  // Filtro Toggle: "Productos con Pedido Pendiente"
  const [pendingOrdersOnly, setPendingOrdersOnly] = useState(false);

  // Ventana Modal de Recepción de Pedido ("¿Llegó el pedido de este producto?")
  const [receivingOrderProduct, setReceivingOrderProduct] =
    useState<ProductItem | null>(null);
  const [receivedQtyInput, setReceivedQtyInput] = useState<string>('1');
  const [receivedMinStockInput, setReceivedMinStockInput] = useState<string>('0');
  const [isReceivingOrder, setIsReceivingOrder] = useState<boolean>(false);

  // Historial de Movimientos de Stock ("Ingreso por recepción de pedido de proveedor")
  const [stockMovements, setStockMovements] = useState<StockMovementEntry[]>(
    () => loadStockMovements()
  );
  const [showStockHistoryModal, setShowStockHistoryModal] =
    useState<boolean>(false);

  const [newProductModalOpen, setNewProductModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Requerimiento 3: Modal de Impresión Rápida de Código de Barras / Etiquetas
  const [barcodeModalProduct, setBarcodeModalProduct] = useState<ProductItem | null>(
    null
  );

  // Modal de Confirmación para Eliminar Producto definitivamente
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado para el Modal Multipestaña de "Editar Producto"
  const [extendedMetaMap, setExtendedMetaMap] = useState<
    Record<number, ProductExtendedMeta>
  >(() => loadProductExtendedMetaMap());
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editActiveTab, setEditActiveTab] = useState<
    'general' | 'precios-stock' | 'proveedores'
  >('general');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [newAssocSupplierInput, setNewAssocSupplierInput] = useState('');
  const [editForm, setEditForm] = useState({
    sku: '',
    name: '',
    barcode: '',
    category: '',
    brand: '',
    description: '',
    salePrice: '',
    costPrice: '',
    ivaRate: '21.00',
    trackStock: true,
    stock: 0,
    minStock: 0,
    purchaseUnit: 'CAJA',
    bulkContent: '1',
    contentType: 'Unidades' as BulkContentType,
    retailMarginPct: '45.00',
    supplierName: '',
    associatedSuppliers: [] as string[],
  });

  const handleOpenEditProductModal = (
    prod: ProductItem,
    initialTab: 'general' | 'precios-stock' | 'proveedores' = 'general'
  ) => {
    const enriched = enrichProductWithExtendedMeta(prod, extendedMetaMap);
    const cleanName = enriched.name.replace(/\s*\[Costo Neto[^\]]*\]/gi, '').trim();
    const meta = extendedMetaMap[prod.id] || {};
    const defaultBarcode =
      enriched.barcode ||
      meta.barcode ||
      `7790895${String(prod.id).padStart(5, '0')}4`;
    const defaultDesc =
      enriched.description !== undefined
        ? enriched.description
        : meta.description !== undefined
        ? meta.description
        : `Artículo de ferretería industrial ${prod.brand} — línea ${prod.category}. Código interno: ${prod.sku}.`;

    const defaultAssociated = Array.isArray(enriched.associatedSuppliers)
      ? enriched.associatedSuppliers
      : Array.isArray(meta.associatedSuppliers)
      ? meta.associatedSuppliers
      : suppliers
          .filter((s) => s.name !== prod.supplierName)
          .slice(0, 1)
          .map((s) => s.name);

    const bulkCost = parseFloat(String(enriched.costPrice || '0')) || 0;
    const contentQty = Math.max(0.0001, Number(enriched.unitsPerPackage) || 1);
    const unitCost = calculateUnitFractionalCost(bulkCost, contentQty);
    const currentSale = parseFloat(String(enriched.salePrice || '0')) || 0;
    const initialMargin =
      meta.retailMarginPct !== undefined
        ? meta.retailMarginPct
        : unitCost > 0 && currentSale > 0
        ? Math.max(0, Number((((currentSale / unitCost) - 1) * 100).toFixed(2)))
        : 45;

    setEditForm({
      sku: enriched.sku,
      name: cleanName,
      barcode: defaultBarcode,
      category: enriched.category || 'Ferretería General',
      brand: enriched.brand || 'Genérico',
      description: defaultDesc,
      salePrice: String(enriched.salePrice || '0.00'),
      costPrice: String(enriched.costPrice || '0.00'),
      ivaRate: String(enriched.ivaRate || '21.00'),
      trackStock: enriched.trackStock !== false,
      stock: enriched.stock ?? 0,
      minStock: enriched.minStock ?? 0,
      purchaseUnit: enriched.purchaseUnit || 'CAJA',
      bulkContent: String(enriched.unitsPerPackage || 1),
      contentType: enriched.contentType || 'Unidades',
      retailMarginPct: String(initialMargin),
      supplierName:
        enriched.supplierName ||
        suppliers[0]?.name ||
        'Distribuidora Herramientas Argentinas S.A.',
      associatedSuppliers: defaultAssociated,
    });
    setEditActiveTab(initialTab);
    setNewAssocSupplierInput('');
    setEditingProduct(enriched);
  };

  // Handlers para actualizar Costo de Bulto, Contenido del Bulto y Margen Minorista en "Editar Producto"
  const handleEditBulkCostChange = (newCostPriceStr: string) => {
    const unitCost = calculateUnitFractionalCost(
      newCostPriceStr,
      editForm.bulkContent
    );
    const margin = parseFloat(String(editForm.retailMarginPct || '0')) || 0;
    const nextSalePrice = (unitCost * (1 + margin / 100)).toFixed(2);
    setEditForm((prev) => ({
      ...prev,
      costPrice: newCostPriceStr,
      salePrice: nextSalePrice,
    }));
  };

  const handleEditBulkContentChange = (newContentStr: string) => {
    const unitCost = calculateUnitFractionalCost(
      editForm.costPrice,
      newContentStr
    );
    const margin = parseFloat(String(editForm.retailMarginPct || '0')) || 0;
    const nextSalePrice = (unitCost * (1 + margin / 100)).toFixed(2);
    setEditForm((prev) => ({
      ...prev,
      bulkContent: newContentStr,
      salePrice: nextSalePrice,
    }));
  };

  const handleEditRetailMarginChange = (newMarginStr: string) => {
    const unitCost = calculateUnitFractionalCost(
      editForm.costPrice,
      editForm.bulkContent
    );
    const margin = parseFloat(String(newMarginStr || '0').replace(',', '.')) || 0;
    const nextSalePrice = (unitCost * (1 + margin / 100)).toFixed(2);
    setEditForm((prev) => ({
      ...prev,
      retailMarginPct: newMarginStr,
      salePrice: nextSalePrice,
    }));
  };

  const handleEditRetailSalePriceChange = (newSaleStr: string) => {
    const unitCost = calculateUnitFractionalCost(
      editForm.costPrice,
      editForm.bulkContent
    );
    const saleVal = parseFloat(String(newSaleStr || '0').replace(',', '.')) || 0;
    const derivedMargin =
      unitCost > 0
        ? (((saleVal / unitCost) - 1) * 100).toFixed(2)
        : editForm.retailMarginPct;
    setEditForm((prev) => ({
      ...prev,
      salePrice: newSaleStr,
      retailMarginPct: derivedMargin,
    }));
  };

  const handleSaveEditedProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editForm.name.trim()) return;
    setIsSavingEdit(true);

    try {
      const parsedContent = Math.max(
        0.01,
        parseFloat(String(editForm.bulkContent || '1').replace(',', '.')) || 1
      );
      const calculatedUnitCost = calculateUnitFractionalCost(
        editForm.costPrice,
        parsedContent
      );
      const parsedMargin =
        parseFloat(String(editForm.retailMarginPct || '45').replace(',', '.')) || 0;

      const updatedMetaMap = saveProductExtendedMeta(editingProduct.id, {
        barcode: editForm.barcode.trim(),
        description: editForm.description.trim(),
        purchaseUnit: editForm.purchaseUnit,
        unitsPerPackage: parsedContent,
        contentType: editForm.contentType,
        unitFractionalCost: Number(calculatedUnitCost.toFixed(2)),
        retailMarginPct: Number(parsedMargin.toFixed(2)),
        associatedSuppliers: editForm.associatedSuppliers,
      });
      setExtendedMetaMap(updatedMetaMap);

      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: editForm.sku.trim(),
          name: editForm.name.trim(),
          category: editForm.category.trim(),
          brand: editForm.brand.trim(),
          supplierName: editForm.supplierName.trim(),
          costPrice: editForm.costPrice,
          ivaRate: editForm.ivaRate,
          salePrice: editForm.salePrice,
          trackStock: editForm.trackStock,
          stock: Number(editForm.stock),
          minStock: Math.max(0, Number(editForm.minStock)),
          status: editForm.trackStock ? 'Activo' : 'Inactivo',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el producto');
      }

      const rawList: ProductItem[] = Array.isArray(data.products)
        ? data.products
        : products.map((p) =>
            p.id === editingProduct.id ? { ...p, ...(data.updated || {}) } : p
          );

      const enrichedList = rawList.map((p) =>
        enrichProductWithExtendedMeta(p, updatedMetaMap)
      );

      const singularUnit = getSingularContentTypeLabel(editForm.contentType);
      onProductsUpdated(
        enrichedList,
        `Producto "${editForm.name.trim()}" actualizado · Costo por ${singularUnit}: ${formatCurrency(
          calculatedUnitCost
        )} · Venta por ${singularUnit}: ${formatCurrency(editForm.salePrice)}`
      );
      setEditingProduct(null);
    } catch (err) {
      console.error('Error updating product:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Ordenamiento por Columnas (Sort A-Z / 0-9: asc -> desc -> null orden original)
  const [sortConfig, setSortConfig] = useState<{
    key: ProductColumnKey | null;
    direction: 'asc' | 'desc';
  }>({
    key: null,
    direction: 'asc',
  });

  // Paginación configurable (Predeterminado: 20 artículos por página)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  // Lookup reactivo de productos que están actualmente en algún Carrito Persistente de Proveedor
  const [supplierCartsLookup, setSupplierCartsLookup] = useState<
    Record<number, { quantity: number; supplierName: string }>
  >(() => getProductsInSupplierCartsLookup());

  useEffect(() => {
    const syncCarts = () => {
      setSupplierCartsLookup(getProductsInSupplierCartsLookup());
    };
    window.addEventListener('storage', syncCarts);
    window.addEventListener('supplier-carts-updated', syncCarts);
    return () => {
      window.removeEventListener('storage', syncCarts);
      window.removeEventListener('supplier-carts-updated', syncCarts);
    };
  }, []);

  // Estado local para edición directa (inline edit) de Stock Actual (permite negativos) y Stock Mínimo
  const [inlineDrafts, setInlineDrafts] = useState<
    Record<number, { stock: string; minStock: string }>
  >({});

  useEffect(() => {
    const nextDrafts: Record<number, { stock: string; minStock: string }> = {};
    products.forEach((p) => {
      nextDrafts[p.id] = {
        stock: String(p.stock ?? 0),
        minStock: String(p.minStock ?? 0),
      };
    });
    setInlineDrafts(nextDrafts);
  }, [products]);

  // Columnas Visibles por Defecto: incluye Código, Descripción, Precio Costo (Bulto y Fraccionado), Precio de Venta, Control de Stock, Stock y Acciones (Editar)
  const [visibleColumns, setVisibleColumns] = useState<Record<ProductColumnKey, boolean>>({
    sku: true,
    name: true,
    supplierName: false,
    category: false,
    brand: false,
    costPrice: true,
    ivaRate: false,
    salePrice: true,
    trackStock: true,
    stockUnified: true,
    status: false,
    barcodeLabel: false,
    actions: true,
    deleteAction: false,
  });
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(event.target as Node)
      ) {
        setColumnsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formulario Nuevo Producto (con lógica de Costo de Bulto -> Costo Unitario/Fraccionado -> Venta por Menor)
  const [autoGenerateSku, setAutoGenerateSku] = useState(true);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: 'Ferretería General',
    brand: 'Makita',
    supplierName:
      suppliers[0]?.name || 'Distribuidora Herramientas Argentinas S.A.',
    costPrice: '45000.00',
    ivaRate: '21.00',
    purchaseUnit: 'CAJA',
    bulkContent: '200',
    contentType: 'Unidades' as BulkContentType,
    retailMarginPct: '50.00',
    salePrice: '337.50',
    trackStock: true,
    stock: 15,
    minStock: 5,
    status: 'Activo',
  });

  const handleNewProdBulkCostChange = (newCostPriceStr: string) => {
    const unitCost = calculateUnitFractionalCost(newCostPriceStr, form.bulkContent);
    const margin = parseFloat(String(form.retailMarginPct || '0')) || 0;
    const nextSale = (unitCost * (1 + margin / 100)).toFixed(2);
    setForm((prev) => ({
      ...prev,
      costPrice: newCostPriceStr,
      salePrice: nextSale,
    }));
  };

  const handleNewProdBulkContentChange = (newContentStr: string) => {
    const unitCost = calculateUnitFractionalCost(form.costPrice, newContentStr);
    const margin = parseFloat(String(form.retailMarginPct || '0')) || 0;
    const nextSale = (unitCost * (1 + margin / 100)).toFixed(2);
    setForm((prev) => ({
      ...prev,
      bulkContent: newContentStr,
      salePrice: nextSale,
    }));
  };

  const handleNewProdRetailMarginChange = (newMarginStr: string) => {
    const unitCost = calculateUnitFractionalCost(form.costPrice, form.bulkContent);
    const margin = parseFloat(String(newMarginStr || '0').replace(',', '.')) || 0;
    const nextSale = (unitCost * (1 + margin / 100)).toFixed(2);
    setForm((prev) => ({
      ...prev,
      retailMarginPct: newMarginStr,
      salePrice: nextSale,
    }));
  };

  const handleNewProdSalePriceChange = (newSaleStr: string) => {
    const unitCost = calculateUnitFractionalCost(form.costPrice, form.bulkContent);
    const saleVal = parseFloat(String(newSaleStr || '0').replace(',', '.')) || 0;
    const derivedMargin =
      unitCost > 0
        ? (((saleVal / unitCost) - 1) * 100).toFixed(2)
        : form.retailMarginPct;
    setForm((prev) => ({
      ...prev,
      salePrice: newSaleStr,
      retailMarginPct: derivedMargin,
    }));
  };

  useEffect(() => {
    if (suppliers.length > 0 && !form.supplierName) {
      setForm((prev) => ({ ...prev, supplierName: suppliers[0].name }));
    }
  }, [suppliers]);

  const generatedSkuPreview = useMemo(() => {
    const brandPrefix = (form.brand || 'GEN')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, 'X');
    const catPrefix = (form.category || 'FER')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, 'G');
    const nextId = String(products.length + 1).padStart(4, '0');
    return `${brandPrefix}-${catPrefix}-${nextId}`;
  }, [form.brand, form.category, products.length]);

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name) names.add(s.name);
    });
    products.forEach((p) => {
      if (p.supplierName) names.add(p.supplierName);
    });
    return ['Todos', ...Array.from(names)];
  }, [suppliers, products]);

  const categories = useMemo(() => {
    const set = new Set<string>(products.map((p) => p.category).filter(Boolean));
    return ['Todas', ...Array.from(set)];
  }, [products]);

  /**
   * Requerimiento 1: Modificación de Reglas de Estado (Producto Activo + Alerta "Sin Stock")
   * - Si un producto está en estado comercial "Activo", mantiene siempre su badge y estado de "Activo"
   *   independientemente de su nivel de inventario (nunca pasa a "Inactivo" automáticamente).
   * - Cuando tiene activado el "Control de Stock" (trackStock = true):
   *   * Si stock < 0: Muestra alerta roja "Sin Stock / Saldo Negativo"
   *   * Si stock === 0: Muestra alerta roja "Sin Stock"
   *   * Si stock > 0 && stock <= minStock: Muestra badge "Stock Crítico"
   * - Cuando trackStock = false: Muestra badge "Por Pedido"
   */
  const getCommercialStatus = (p: ProductItem): 'Activo' | 'Inactivo' => {
    if (p.trackStock === false) return 'Inactivo';
    const st = (p.status || '').trim().toLowerCase();
    return st === 'inactivo' ? 'Inactivo' : 'Activo';
  };

  const getInventoryAlertBadge = (p: ProductItem): string | null => {
    const tracks = p.trackStock !== false;
    if (!tracks) return null;
    if (p.stock < 0) return 'SIN STOCK';
    if (p.stock === 0) return 'SIN STOCK';
    if (p.stock <= p.minStock) return 'STOCK BAJO';
    return null;
  };

  // Clic en la columna "Control de Stock"
  const handleToggleProductTrackStock = async (prod: ProductItem) => {
    const nextTrackStock = !(prod.trackStock !== false);
    const currentStock = prod.stock ?? 0;
    const currentMin = prod.minStock ?? 0;
    const nextCommercialStatus = nextTrackStock ? 'Activo' : 'Inactivo';
    const nextHadStock = Boolean(prod.hadStock) || currentStock > 0 || nextTrackStock;

    const optimisticList = products.map((item) =>
      item.id === prod.id
        ? {
            ...item,
            trackStock: nextTrackStock,
            hadStock: nextHadStock,
            status: nextCommercialStatus,
          }
        : item
    );

    onProductsUpdated(
      optimisticList,
      nextTrackStock
        ? `Control de stock activado para ${prod.sku} (Estado: Activo)`
        : `Control de stock desactivado para ${prod.sku}`
    );

    try {
      const res = await fetch(`/api/products/${prod.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackStock: nextTrackStock,
          stock: currentStock,
          minStock: currentMin,
          status: nextCommercialStatus,
        }),
      });
      if (res.ok) {
        const updatedRow = await res.json();
        onProductsUpdated(
          products.map((item) => (item.id === prod.id ? updatedRow : item)),
          nextTrackStock
            ? `Control de stock activado para ${prod.sku}`
            : `Control de stock desactivado para ${prod.sku}`
        );
      }
    } catch (err) {
      console.error('Error toggling trackStock:', err);
    }
  };

  // Guardar edición directa (Inline Edit) de Stock Actual (permitiendo negativos ej. -2, -5) y Stock Mínimo
  const handleCommitInlineStock = async (prod: ProductItem) => {
    if (prod.trackStock === false) return;
    const draft = inlineDrafts[prod.id];
    if (!draft) return;

    // Permitir números negativos (ej. -2, -5)
    const parsedStock = parseInt(draft.stock, 10);
    const newStock = Number.isFinite(parsedStock) ? parsedStock : 0;

    const parsedMinStock = parseInt(draft.minStock, 10);
    const newMinStock = Number.isFinite(parsedMinStock)
      ? Math.max(0, parsedMinStock)
      : 0;

    if (newStock === prod.stock && newMinStock === prod.minStock) {
      return;
    }

    const commercialStatus = getCommercialStatus(prod);

    const nextHadStock = Boolean(prod.hadStock) || prod.stock > 0 || newStock > 0;

    const optimisticList = products.map((item) =>
      item.id === prod.id
        ? {
            ...item,
            hadStock: nextHadStock,
            orderedQty: newStock !== prod.stock ? 0 : prod.orderedQty ?? 0,
            stock: newStock,
            minStock: newMinStock,
            status: commercialStatus,
          }
        : item
    );

    const statusNote =
      newStock <= 0
        ? ' (Alerta: SIN STOCK)'
        : newStock <= newMinStock
        ? ' (Alerta: STOCK BAJO)'
        : '';

    onProductsUpdated(
      optimisticList,
      `Stock actualizado en ${prod.sku}: Actual ${newStock} u. / Mínimo ${newMinStock} u.${statusNote}`
    );

    try {
      const res = await fetch(`/api/products/${prod.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackStock: true,
          stock: newStock,
          minStock: newMinStock,
          status: commercialStatus,
        }),
      });
      if (res.ok) {
        const updatedRow = await res.json();
        onProductsUpdated(
          products.map((item) => (item.id === prod.id ? updatedRow : item)),
          `Stock guardado para ${prod.sku}: Actual ${newStock} u.${statusNote}`
        );
      }
    } catch (err) {
      console.error('Error saving inline stock:', err);
    }
  };

  const handleSortColumn = (key: ProductColumnKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        }
        return { key: null, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Reiniciar a Página 1 automáticamente al cambiar búsqueda o filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [
    supplierFilter,
    categoryFilter,
    statusFilter,
    pendingOrdersOnly,
    searchQuery,
  ]);

  // Abrir Ventana Modal de Recepción de Pedido ("¿Llegó el pedido de este producto?")
  const handleOpenReceiveOrderModal = (prod: ProductItem) => {
    const requested = Math.max(1, prod.orderedQty ?? 1);
    setReceivingOrderProduct(prod);
    setReceivedQtyInput(String(requested));
    setReceivedMinStockInput(String(prod.minStock ?? 0));
  };

  // Confirmar Recepción Total o Parcial de Pedido y generar movimiento en Historial de Stock
  const handleProcessOrderReception = async (
    receptionMode: 'complete' | 'partial'
  ) => {
    if (!receivingOrderProduct) return;
    const target = receivingOrderProduct;
    const requestedQty = Math.max(1, target.orderedQty ?? 1);
    const parsedReceived = Math.max(
      1,
      Math.round(parseFloat(String(receivedQtyInput || '0').replace(',', '.')) || 0)
    );

    setIsReceivingOrder(true);
    try {
      const isPartial = receptionMode === 'partial';
      const previousStock = target.stock ?? 0;
      const newStock = previousStock + parsedReceived;
      const remainingPendingQty = isPartial
        ? Math.max(0, requestedQty - parsedReceived)
        : 0;
      const orderStatus: 'Completado/Recibido' | 'Recepción Parcial' =
        remainingPendingQty === 0 ? 'Completado/Recibido' : 'Recepción Parcial';

      const cleanName = target.name
        .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
        .trim();

      const parsedMinStock = Math.max(
        0,
        Math.round(
          parseFloat(String(receivedMinStockInput || '0').replace(',', '.')) || 0
        )
      );

      const res = await fetch(`/api/products/${target.id}/receive-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedQty: parsedReceived,
          minStock: parsedMinStock,
          isPartial: remainingPendingQty > 0,
        }),
      });

      if (parsedMinStock !== (target.minStock ?? 0)) {
        await fetch(`/api/products/${target.id}/stock`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackStock: true,
            stock: newStock,
            minStock: parsedMinStock,
            status: 'Activo',
          }),
        }).catch(() => {});
      }

      let nextProductsList = products.map((p) =>
        p.id === target.id
          ? {
              ...p,
              trackStock: true,
              hadStock: true,
              stock: newStock,
              minStock: parsedMinStock,
              orderedQty: remainingPendingQty,
              status: 'Activo',
            }
          : p
      );

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          nextProductsList = data.products.map((p: ProductItem) =>
            enrichProductWithExtendedMeta(
              p.id === target.id ? { ...p, minStock: parsedMinStock } : p,
              extendedMetaMap
            )
          );
        }
      }

      // 3. Registro de Movimiento automático en el historial de stock del producto:
      // "Ingreso por recepción de pedido de proveedor"
      const nowFormatted = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const movementEntry: StockMovementEntry = {
        id: `MOV-${Date.now()}-${target.id}`,
        productId: target.id,
        sku: target.sku,
        productName: cleanName,
        supplierName: target.supplierName || 'Proveedor General',
        createdAt: nowFormatted,
        movementType: 'ENTRADA',
        detail: 'Ingreso por recepción de pedido de proveedor',
        orderStatus,
        requestedQty,
        receivedQty: parsedReceived,
        remainingPendingQty,
        previousStock,
        newStock,
      };

      const updatedMovements = appendStockMovement(movementEntry);
      setStockMovements(updatedMovements);

      // Si se confirmó recepción completa y ya no quedan otros productos con pedido pendiente,
      // o si el usuario estaba filtrando, el producto queda con orderedQty = 0 y sale del filtro.
      const remainingProductsWithOrders = nextProductsList.filter(
        (p) => (p.orderedQty ?? 0) > 0
      ).length;
      if (
        !isPartial &&
        pendingOrdersOnly &&
        remainingProductsWithOrders === 0
      ) {
        setPendingOrdersOnly(false);
      }

      onProductsUpdated(
        nextProductsList,
        remainingPendingQty === 0
          ? `Ingreso por recepción de pedido de proveedor (${cleanName}): +${parsedReceived} u. sumadas al stock (Stock actual: ${newStock} u. · Estado: Completado/Recibido).`
          : `Ingreso por recepción de pedido de proveedor — Recepción Parcial (${cleanName}): +${parsedReceived} u. ingresadas al stock · Quedan ${remainingPendingQty} u. pendientes.`
      );
      setReceivingOrderProduct(null);
    } catch (err) {
      console.error('Error receiving product order:', err);
    } finally {
      setIsReceivingOrder(false);
    }
  };

  // Filtrado y Ordenamiento (A-Z / 0-9 y viceversa)
  const filteredAndSortedProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const commercialStatus = getCommercialStatus(p);

      if (supplierFilter !== 'Todos' && p.supplierName !== supplierFilter) {
        return false;
      }
      if (categoryFilter !== 'Todas' && p.category !== categoryFilter) {
        return false;
      }

      // 1. Filtro en la Tabla de Inventario: "Productos con Pedido Pendiente"
      // Al activarlo, muestra únicamente los artículos que tengan una orden de compra o pedido activo a proveedor sin recibir.
      if (pendingOrdersOnly) {
        if (!((p.orderedQty ?? 0) > 0)) {
          return false;
        }
      } else {
        if (statusFilter === 'Activos' && commercialStatus !== 'Activo') {
          return false;
        }
        if (
          statusFilter === 'Sin Stock' &&
          !(p.trackStock !== false && p.stock <= 0)
        ) {
          return false;
        }
        if (
          (statusFilter === 'Stock Bajo' || statusFilter === 'Stock Crítico') &&
          !(p.trackStock !== false && p.stock > 0 && p.stock <= p.minStock)
        ) {
          return false;
        }
        // Pestaña "Tuvo Stock"
        if (statusFilter === 'Tuvo Stock') {
          const hadHistoricalStock = Boolean(p.hadStock) || (p.stock ?? 0) > 0;
          if (!(p.trackStock === false && hadHistoricalStock)) {
            return false;
          }
        }
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.supplierName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (!sortConfig.key) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const key = sortConfig.key!;

      if (key === 'costPrice' || key === 'salePrice' || key === 'ivaRate') {
        const numA = parseFloat(String(a[key] || '0')) || 0;
        const numB = parseFloat(String(b[key] || '0')) || 0;
        return (numA - numB) * dir;
      }

      if (key === 'stockUnified') {
        const stockA = a.trackStock === false ? -999999 : a.stock;
        const stockB = b.trackStock === false ? -999999 : b.stock;
        return (stockA - stockB) * dir;
      }

      if (key === 'trackStock') {
        const valA = a.trackStock !== false ? 1 : 0;
        const valB = b.trackStock !== false ? 1 : 0;
        return (valA - valB) * dir;
      }

      if (key === 'status') {
        const stA = `${getCommercialStatus(a)} ${getInventoryAlertBadge(a) || ''}`;
        const stB = `${getCommercialStatus(b)} ${getInventoryAlertBadge(b) || ''}`;
        return stA.localeCompare(stB, 'es', { sensitivity: 'base' }) * dir;
      }

      const strA = String((a as any)[key] || '');
      const strB = String((b as any)[key] || '');
      return (
        strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' }) *
        dir
      );
    });
  }, [
    products,
    supplierFilter,
    categoryFilter,
    statusFilter,
    pendingOrdersOnly,
    searchQuery,
    sortConfig,
  ]);

  const { paginatedItems: paginatedProducts, safePage: safeProductPage } =
    useMemo(
      () => paginateArray(filteredAndSortedProducts, currentPage, pageSize),
      [filteredAndSortedProducts, currentPage, pageSize]
    );

  const toggleColumnVisibility = (key: ProductColumnKey) => {
    const activeCount = Object.values(visibleColumns).filter(Boolean).length;
    if (visibleColumns[key] && activeCount <= 2) {
      return;
    }
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetAllColumns = () => {
    setVisibleColumns({
      sku: true,
      name: true,
      supplierName: true,
      category: true,
      brand: true,
      costPrice: true,
      ivaRate: true,
      salePrice: true,
      trackStock: true,
      stockUnified: true,
      status: true,
      barcodeLabel: true,
      actions: true,
      deleteAction: true,
    });
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const target = productToDelete;
    const cleanName = target.name.replace(/\s*\[Costo Neto[^\]]*\]/gi, '').trim();
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${target.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el producto');
      }
      const nextProducts = Array.isArray(data.products)
        ? data.products
        : products.filter((p) => p.id !== target.id);
      onProductsUpdated(
        nextProducts,
        `Producto "${cleanName}" (${target.sku}) eliminado definitivamente.`
      );
      setProductToDelete(null);
    } catch (err) {
      console.error('Error deleting product:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateSingleProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSku = autoGenerateSku ? generatedSkuPreview : form.sku.trim();
    if (!finalSku || !form.name.trim()) return;

    setIsSaving(true);
    try {
      const parsedContent = Math.max(
        0.01,
        parseFloat(String(form.bulkContent || '1').replace(',', '.')) || 1
      );
      const calculatedUnitCost = calculateUnitFractionalCost(
        form.costPrice,
        parsedContent
      );
      const parsedMargin =
        parseFloat(String(form.retailMarginPct || '45').replace(',', '.')) || 0;

      const payload = {
        ...form,
        sku: finalSku,
        stock: form.trackStock ? form.stock : 0,
        minStock: form.trackStock ? form.minStock : 0,
        status: form.trackStock ? 'Activo' : 'Inactivo',
      };

      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [payload] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar producto');

      const returnedList: ProductItem[] = Array.isArray(data.products)
        ? data.products
        : [];
      const createdProd = returnedList.find((p) => p.sku === finalSku);
      let updatedMeta = extendedMetaMap;
      if (createdProd) {
        updatedMeta = saveProductExtendedMeta(createdProd.id, {
          purchaseUnit: form.purchaseUnit,
          unitsPerPackage: parsedContent,
          contentType: form.contentType,
          unitFractionalCost: Number(calculatedUnitCost.toFixed(2)),
          retailMarginPct: Number(parsedMargin.toFixed(2)),
        });
        setExtendedMetaMap(updatedMeta);
      }

      const enrichedList = returnedList.map((p) =>
        enrichProductWithExtendedMeta(p, updatedMeta)
      );
      const singularLabel = getSingularContentTypeLabel(form.contentType);

      onProductsUpdated(
        enrichedList,
        `Producto ${finalSku} guardado · Costo por ${singularLabel}: ${formatCurrency(
          calculatedUnitCost
        )} · Venta por ${singularLabel}: ${formatCurrency(form.salePrice)}`
      );
      setNewProductModalOpen(false);
      setForm({
        sku: '',
        name: '',
        category: 'Ferretería General',
        brand: 'Bosch',
        supplierName:
          suppliers[0]?.name || 'Distribuidora Herramientas Argentinas S.A.',
        costPrice: '32000.00',
        ivaRate: '21.00',
        purchaseUnit: 'CAJA',
        bulkContent: '100',
        contentType: 'Unidades',
        retailMarginPct: '50.00',
        salePrice: '480.00',
        trackStock: true,
        stock: 12,
        minStock: 5,
        status: 'Activo',
      });
      setAutoGenerateSku(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const activeCommercialCount = products.filter(
    (p) => getCommercialStatus(p) === 'Activo'
  ).length;

  const outOfStockCount = products.filter(
    (p) => p.trackStock !== false && p.stock <= 0
  ).length;

  const criticalCount = products.filter(
    (p) => p.trackStock !== false && p.stock > 0 && p.stock <= p.minStock
  ).length;

  const pendingOrdersCount = products.filter(
    (p) => (p.orderedQty ?? 0) > 0
  ).length;

  const activeColumnsList = ALL_PRODUCT_COLUMNS.filter(
    (col) => visibleColumns[col.key]
  );

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Artículos en Comercialización (Activos)
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
              {activeCommercialCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Mantienen estado Activo aún con stock en 0 o negativo
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Alerta "Sin Stock" / Saldo Negativo (≤ 0)
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-rose-700 mt-1">
              {outOfStockCount}
            </p>
            <p className="text-xs text-rose-700 font-medium mt-1">
              Permite venta con stock negativo (ej. -2, -5)
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Alerta de "Stock Crítico" (≤ Stock Mínimo)
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
              {criticalCount}
            </p>
            <p className="text-xs text-amber-800 font-medium mt-1">
              Artículos próximos a agotarse
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Products Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-visible">
        {/* Top Action & Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar código, nombre, marca..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Filtro por Proveedores */}
            <div className="flex items-center gap-1.5">
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                aria-label="Filtrar por Proveedor"
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#FF6600] max-w-[215px] truncate"
              >
                {supplierOptions.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup === 'Todos' ? 'Todos los proveedores' : sup}
                  </option>
                ))}
              </select>

              {/* Category Selector */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar por Categoría"
                className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#FF6600] max-w-[165px] truncate"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'Todas' ? 'Todas las categorías' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Pestañas de Filtro (Incluye "Tuvo Stock" para historial de existencias hoy en <= 0) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {['Activos', 'Todos', 'Sin Stock', 'Stock Bajo', 'Tuvo Stock'].map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st);
                      setPendingOrdersOnly(false);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      !pendingOrdersOnly && statusFilter === st
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>

            {/* 1. Filtro Toggle en la Tabla de Inventario: "Productos con Pedido Pendiente" */}
            <button
              type="button"
              aria-pressed={pendingOrdersOnly}
              onClick={() => setPendingOrdersOnly((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                pendingOrdersOnly
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-600/20'
                  : 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span>Productos con Pedido Pendiente</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                  pendingOrdersOnly
                    ? 'bg-white text-indigo-700'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {pendingOrdersCount}
              </span>
            </button>

            {/* Botón para ver Historial de Movimientos de Stock */}
            <button
              type="button"
              onClick={() => setShowStockHistoryModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors whitespace-nowrap cursor-pointer"
              title="Ver historial de ingresos por recepción de pedidos de proveedor"
            >
              <History className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
              <span>Historial de Stock ({stockMovements.length})</span>
            </button>
          </div>

          {/* Right Toolbar: Columnas Selector + Bulk Import + Nuevo Producto */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="relative" ref={columnsMenuRef}>
              <button
                type="button"
                onClick={() => setColumnsDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6600]"
              >
                <Columns3 className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  Columnas ({activeColumnsList.length}/{ALL_PRODUCT_COLUMNS.length})
                </span>
              </button>

              {columnsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-40">
                  <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Columnas Visibles
                    </span>
                    <button
                      type="button"
                      onClick={resetAllColumns}
                      className="text-[11px] font-semibold text-[#FF6600] hover:underline cursor-pointer"
                    >
                      Mostrar todas
                    </button>
                  </div>
                  <div className="py-1 max-h-80 overflow-y-auto">
                    {ALL_PRODUCT_COLUMNS.map((col) => {
                      const isChecked = visibleColumns[col.key];
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => toggleColumnVisibility(col.key)}
                          className="w-full px-3.5 py-2 text-left flex items-center justify-between text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <span
                            className={
                              isChecked
                                ? 'font-semibold text-slate-900'
                                : 'text-slate-500'
                            }
                          >
                            {col.label}
                          </span>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-[#FF6600] border-[#FF6600] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenBulkImport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6600]"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Importación Masiva (Excel/CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => setNewProductModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* Products Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 select-none">
                {activeColumnsList.map((col) => {
                  const isSorted = sortConfig.key === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSortColumn(col.key)}
                      title={`Ordenar por ${col.label}`}
                      className={`py-3 px-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-100/90 hover:text-slate-900 transition-colors ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 ${
                          col.align === 'right'
                            ? 'justify-end'
                            : col.align === 'center'
                            ? 'justify-center'
                            : 'justify-start'
                        }`}
                      >
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {filteredAndSortedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeColumnsList.length}
                    className="py-10 text-center text-slate-500"
                  >
                    No se encontraron productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => {
                  const tracks = prod.trackStock !== false;
                  const isOutOfStock = tracks && prod.stock <= 0;
                  const isNegativeStock = tracks && prod.stock < 0;
                  const isCriticalStock =
                    tracks && prod.stock > 0 && prod.stock <= prod.minStock;
                  const commercialStatus = getCommercialStatus(prod);
                  const alertBadge = getInventoryAlertBadge(prod);

                  const draft = inlineDrafts[prod.id] || {
                    stock: String(prod.stock ?? 0),
                    minStock: String(prod.minStock ?? 0),
                  };

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        isOutOfStock
                          ? 'bg-rose-50/30'
                          : isCriticalStock
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Columna Código / SKU */}
                      {visibleColumns.sku && (
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            {prod.sku}
                          </span>
                        </td>
                      )}

                      {/* Columna Nombre / Descripción con alertas SIN STOCK (rojo), STOCK BAJO (amarillo), En Carrito y Pedido Pendiente */}
                      {visibleColumns.name && (
                        <td className="py-3 px-3.5 font-medium text-slate-900 min-w-[220px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              {prod.name.replace(/\s*\[Costo Neto[^\]]*\]/gi, '').trim()}
                            </span>
                            {tracks && isOutOfStock && (
                              <StatusBadge status="SIN STOCK" />
                            )}
                            {tracks && isCriticalStock && (
                              <StatusBadge status="STOCK BAJO" />
                            )}
                            {supplierCartsLookup[prod.id]?.quantity > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-[#FF6600] border border-orange-200 select-none cursor-default">
                                <ShoppingCart className="w-3 h-3 shrink-0" />
                                <span>
                                  En Carrito ({supplierCartsLookup[prod.id].quantity} u.)
                                </span>
                              </span>
                            )}
                            {(prod.orderedQty ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 select-none cursor-default">
                                <Truck className="w-3 h-3 shrink-0" />
                                <span>
                                  Pedido Pendiente ({prod.orderedQty} u.)
                                </span>
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {visibleColumns.supplierName && (
                        <td className="py-3 px-3.5 text-xs text-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[190px] font-medium">
                              {prod.supplierName || 'Proveedor General'}
                            </span>
                          </div>
                        </td>
                      )}

                      {visibleColumns.category && (
                        <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                          {prod.category}
                        </td>
                      )}

                      {visibleColumns.brand && (
                        <td className="py-3 px-3.5 font-medium text-slate-700 whitespace-nowrap">
                          {prod.brand}
                        </td>
                      )}

                      {visibleColumns.costPrice && (
                        <td className="py-3 px-3.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {(() => {
                            const enriched = enrichProductWithExtendedMeta(
                              prod,
                              extendedMetaMap
                            );
                            const singularUnit = getSingularContentTypeLabel(
                              enriched.contentType
                            );
                            const unitCost =
                              enriched.unitFractionalCost ??
                              calculateUnitFractionalCost(
                                enriched.costPrice,
                                enriched.unitsPerPackage || 1
                              );
                            const contentQty = enriched.unitsPerPackage || 1;
                            const bulkLabel = enriched.purchaseUnit || 'CAJA';
                            return (
                              <div className="flex flex-col items-end gap-0.5">
                                <span
                                  title="Precio / Costo general del Bulto importado por lista"
                                  className="font-semibold text-slate-800"
                                >
                                  Bulto ({bulkLabel}): {formatCurrency(enriched.costPrice)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenEditProductModal(
                                      prod,
                                      'precios-stock'
                                    )
                                  }
                                  title="Clic para configurar Unidad de Bulto, Contenido y Costo Fraccionado"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 hover:bg-orange-100 text-[#FF6600] border border-orange-200 text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  <Calculator className="w-2.5 h-2.5 shrink-0" />
                                  <span>
                                    Costo por {singularUnit}:{' '}
                                    {formatCurrency(unitCost)}
                                    {contentQty > 1
                                      ? ` (÷ ${contentQty} ${enriched.contentType})`
                                      : ''}
                                  </span>
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {visibleColumns.ivaRate && (
                        <td className="py-3 px-3.5 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {parseFloat(String(prod.ivaRate || '21'))}%
                        </td>
                      )}

                      {visibleColumns.salePrice && (
                        <td className="py-3 px-3.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {(() => {
                            const enriched = enrichProductWithExtendedMeta(
                              prod,
                              extendedMetaMap
                            );
                            const singularUnit = getSingularContentTypeLabel(
                              enriched.contentType
                            );
                            const margin = enriched.retailMarginPct ?? 45;
                            return (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-slate-900 font-bold">
                                  {formatCurrency(prod.salePrice)}
                                </span>
                                <span className="text-[10px] font-sans font-medium text-emerald-700">
                                  Venta por {singularUnit} (+
                                  {Number(margin).toFixed(0)}% s/costo unit.)
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* Columna "Control de Stock": Opción B — Switch/Toggle desplazable e interactivo en tiempo real */}
                      {visibleColumns.trackStock && (
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex flex-col items-center gap-1">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={tracks}
                              onClick={() => handleToggleProductTrackStock(prod)}
                              title={
                                tracks
                                  ? 'CONTROLA STOCK (Clic para cambiar a NO LLEVA CONTROL DE STOCK)'
                                  : 'NO LLEVA CONTROL DE STOCK (Clic para activar CONTROLA STOCK)'
                              }
                              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                                tracks ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out ${
                                  tracks ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-tight ${
                                tracks ? 'text-emerald-700' : 'text-slate-500'
                              }`}
                            >
                              {tracks
                                ? 'CONTROLA STOCK'
                                : 'NO LLEVA CONTROL DE STOCK'}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Columna "Stock": Si está activado habilita carga rápida de Stock y Stock Mínimo; de lo contrario muestra "-" */}
                      {visibleColumns.stockUnified && (
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {tracks ? (
                            <div className="flex flex-col gap-1.5 w-40">
                              {/* Arriba: Stock Actual (sin min=0 para permitir negativos) */}
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10px] font-semibold text-slate-500">
                                  Actual:
                                </span>
                                <input
                                  type="number"
                                  value={draft.stock}
                                  onChange={(e) =>
                                    setInlineDrafts((prev) => ({
                                      ...prev,
                                      [prod.id]: {
                                        ...draft,
                                        stock: e.target.value,
                                      },
                                    }))
                                  }
                                  onBlur={() => handleCommitInlineStock(prod)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className={`w-20 px-2 py-0.5 text-xs font-mono tabular-nums font-bold text-right rounded border transition-colors focus:outline-none focus:border-[#FF6600] bg-white ${
                                    isOutOfStock
                                      ? 'border-rose-400 text-rose-700 bg-rose-50/70'
                                      : isCriticalStock
                                      ? 'border-amber-400 text-amber-800 bg-amber-50/50'
                                      : 'border-slate-200 text-slate-900'
                                  }`}
                                />
                              </div>

                              {/* Abajo: Stock Mínimo */}
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10px] font-medium text-slate-400">
                                  Mínimo:
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.minStock}
                                  onChange={(e) =>
                                    setInlineDrafts((prev) => ({
                                      ...prev,
                                      [prod.id]: {
                                        ...draft,
                                        minStock: e.target.value,
                                      },
                                    }))
                                  }
                                  onBlur={() => handleCommitInlineStock(prod)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-20 px-2 py-0.5 text-[11px] font-mono tabular-nums text-right rounded border border-slate-200 text-slate-600 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600] transition-colors"
                                />
                              </div>

                              {(prod.orderedQty ?? 0) > 0 && (
                                <div className="pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceiveOrderModal(prod)}
                                    title="Clic para recibir pedido de proveedor e ingresar al stock"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 w-full justify-center transition-colors cursor-pointer"
                                  >
                                    <PackageCheck className="w-3 h-3 shrink-0" />
                                    <span>Recibir Pedido ({prod.orderedQty} u.)</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-slate-400 font-mono select-none">
                                -
                              </span>
                              {(prod.orderedQty ?? 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReceiveOrderModal(prod)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 transition-colors cursor-pointer"
                                >
                                  <PackageCheck className="w-3 h-3 shrink-0" />
                                  <span>Recibir Pedido ({prod.orderedQty} u.)</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Columna Estado y Alertas — Muestra "-" sin evaluar alertas cuando trackStock = false */}
                      {visibleColumns.status && (
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {tracks ? (
                            <div className="flex flex-col items-start gap-1">
                              <StatusBadge status={commercialStatus} />
                              {alertBadge && <StatusBadge status={alertBadge} />}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono select-none">
                              -
                            </span>
                          )}
                        </td>
                      )}

                      {/* Columna Opcional: "Etiqueta" (Imprimir Código de Barras) */}
                      {visibleColumns.barcodeLabel && (
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setBarcodeModalProduct(prod)}
                            title="Imprimir Código de Barras / Etiqueta"
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#FF6600] text-slate-700 hover:text-white border border-slate-200 hover:border-[#FF6600] text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <ScanBarcode className="w-4 h-4 shrink-0" />
                            <span>Imprimir</span>
                          </button>
                        </td>
                      )}

                      {/* Columna "Acciones": Exclusivamente botón de "Editar" (sin botón de recepción de pedido) */}
                      {visibleColumns.actions && (
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProductModal(prod)}
                            title={`Editar producto ${prod.sku}`}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#FF6600] text-slate-700 hover:text-white border border-slate-200 hover:border-[#FF6600] text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 shrink-0" />
                            <span>Editar</span>
                          </button>
                        </td>
                      )}

                      {/* Columna Opcional (oculta por defecto): "Eliminar Producto" (Icono papelera con modal de confirmación) */}
                      {visibleColumns.deleteAction && (
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setProductToDelete(prod)}
                            title={`Eliminar producto ${prod.sku}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                          </button>
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
          totalItems={filteredAndSortedProducts.length}
          currentPage={safeProductPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setCurrentPage(1);
          }}
          itemLabel="productos"
        />
      </div>

      {/* Modal / Pantalla de Edición Multipestaña: "Editar Producto" (General / Precios y Stock / Proveedores) */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FF6600] flex items-center justify-center text-white shrink-0">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Editar Producto — {editingProduct.sku}
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-md">
                    {editForm.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navegación de Pestañas: General | Precios y Stock | Proveedores */}
            <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
              {[
                {
                  id: 'general' as const,
                  label: 'General',
                  icon: Layers,
                },
                {
                  id: 'precios-stock' as const,
                  label: 'Precios y Stock',
                  icon: Tag,
                },
                {
                  id: 'proveedores' as const,
                  label: 'Proveedores',
                  icon: Truck,
                },
              ].map((tabItem) => {
                const TabIcon = tabItem.icon;
                const active = editActiveTab === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => setEditActiveTab(tabItem.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-[#FF6600] text-[#FF6600] bg-white rounded-t-lg'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    <span>{tabItem.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveEditedProduct} className="p-6 space-y-5">
              {/* PESTAÑA 1: GENERAL */}
              {editActiveTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm font-semibold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Código de Barras (EAN / UPC)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editForm.barcode}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              barcode: e.target.value,
                            })
                          }
                          placeholder="Ej. 7790895001244"
                          className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              barcode: `779${Math.floor(
                                1000000000 + Math.random() * 8999999999
                              )}`,
                            })
                          }
                          title="Generar EAN-13 automático"
                          className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          <ScanBarcode className="w-4 h-4 text-[#FF6600]" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Código Interno / SKU *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.sku}
                        onChange={(e) =>
                          setEditForm({ ...editForm, sku: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Categoría / Rubro *
                      </label>
                      <input
                        type="text"
                        required
                        list="edit-product-categories"
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm({ ...editForm, category: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                      />
                      <datalist id="edit-product-categories">
                        {categories
                          .filter((c) => c !== 'Todas')
                          .map((cat) => (
                            <option key={cat} value={cat} />
                          ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Marca *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.brand}
                        onChange={(e) =>
                          setEditForm({ ...editForm, brand: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Descripción Técnica / Observaciones del Artículo
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Especificaciones técnicas, medidas, presentación y usos..."
                      className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  {/* Carga directa de Stock Actual y Stock Mínimo desde la pestaña General */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Stock Actual (Unidades)
                        </label>
                        <input
                          type="number"
                          value={editForm.stock}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              stock: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-amber-800 mb-1">
                          Stock Mínimo (Alerta de Reposición)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editForm.minStock}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              minStock: Math.max(
                                0,
                                parseInt(e.target.value, 10) || 0
                              ),
                            })
                          }
                          className="w-full px-3 py-2 text-sm font-mono font-bold border border-amber-400 rounded-lg bg-amber-50/40 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA 2: PRECIOS Y STOCK (CÁLCULO EXCLUSIVO DE COSTO UNITARIO / FRACCIONADO DESDE EL BULTO) */}
              {editActiveTab === 'precios-stock' &&
                (() => {
                  const bulkPriceNum =
                    Math.max(
                      0,
                      parseFloat(
                        String(editForm.costPrice || '0').replace(',', '.')
                      ) || 0
                    );
                  const bulkContentNum = Math.max(
                    0.0001,
                    parseFloat(
                      String(editForm.bulkContent || '1').replace(',', '.')
                    ) || 1
                  );
                  const calculatedUnitCost = calculateUnitFractionalCost(
                    bulkPriceNum,
                    bulkContentNum
                  );
                  const singularLabel = getSingularContentTypeLabel(
                    editForm.contentType
                  );
                  const shortUnit = getShortContentTypeUnit(editForm.contentType);
                  const marginNum =
                    parseFloat(
                      String(editForm.retailMarginPct || '0').replace(',', '.')
                    ) || 0;
                  const salePriceNum =
                    parseFloat(
                      String(editForm.salePrice || '0').replace(',', '.')
                    ) || 0;
                  const unitNetProfit = salePriceNum - calculatedUnitCost;
                  const totalBulkSaleRevenue = salePriceNum * bulkContentNum;

                  return (
                    <div className="space-y-4">
                      {/* 1. CAMPOS DE ENTRADA EN "PRECIOS Y STOCK": Precio del Bulto + Unidad de Bulto + Contenido del Bulto + Tipo de Contenido */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              <Boxes className="w-4 h-4 text-[#FF6600]" />
                              <span>
                                1. Precio del Bulto (Lista de Importación) y Configuración de Fraccionamiento
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Mantiene el precio/costo general del Bulto tal como se importa de las listas de proveedores.
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-[11px] font-bold">
                            1 {editForm.purchaseUnit} = {editForm.bulkContent || 1}{' '}
                            {editForm.contentType}
                          </span>
                        </div>

                        {/* Fila superior: Precio/Costo General del Bulto (Lista) + IVA */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Precio / Costo Total del Bulto (Cargado por Lista ARS) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={editForm.costPrice}
                              onChange={(e) =>
                                handleEditBulkCostChange(e.target.value)
                              }
                              className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">
                              Valor total de compra del bulto cerrado ({editForm.purchaseUnit}) según lista del proveedor.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Alícuota IVA (%)
                            </label>
                            <select
                              value={editForm.ivaRate}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  ivaRate: e.target.value,
                                })
                              }
                              className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                            >
                              <option value="21.00">21%</option>
                              <option value="10.50">10.5%</option>
                              <option value="27.00">27%</option>
                              <option value="0.00">0% (Exento)</option>
                            </select>
                          </div>
                        </div>

                        {/* Fila de 3 campos: Unidad de Bulto | Contenido del Bulto | Tipo de Contenido */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                          {/* Selector 1: Unidad de Bulto */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Unidad de Bulto *
                            </label>
                            <select
                              value={editForm.purchaseUnit}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  purchaseUnit: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 text-xs sm:text-sm font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600]"
                            >
                              {BULK_UNIT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Campo numérico 2: Contenido del Bulto */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Contenido del Bulto *
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              required
                              placeholder="Ej: 200, 100, 25"
                              value={editForm.bulkContent}
                              onChange={(e) =>
                                handleEditBulkContentChange(e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600]"
                            />
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              <span className="text-[10px] text-slate-400 mr-0.5">
                                Rápido:
                              </span>
                              {[1, 10, 25, 50, 100, 200].map((presetQty) => (
                                <button
                                  key={presetQty}
                                  type="button"
                                  onClick={() =>
                                    handleEditBulkContentChange(String(presetQty))
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                                    Number(editForm.bulkContent) === presetQty
                                      ? 'bg-[#FF6600] text-white border-[#FF6600]'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {presetQty}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Selector 3: Tipo de Contenido */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Tipo de Contenido *
                            </label>
                            <select
                              value={editForm.contentType}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  contentType: e.target.value as BulkContentType,
                                })
                              }
                              className="w-full px-3 py-2 text-xs sm:text-sm font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-[#FF6600]"
                            >
                              {BULK_CONTENT_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-500 mt-1">
                              Ej: 200 unidades, 100 metros, 25 kilos
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 2. CÁLCULO AUTOMÁTICO DEL COSTO UNITARIO / FRACCIONADO (SOLO LECTURA) */}
                      <div className="p-4 rounded-xl bg-orange-50/70 border-2 border-[#FF6600]/40 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#FF6600] text-white flex items-center justify-center shrink-0">
                              <Calculator className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider text-[#FF6600] block">
                                2. Cálculo Automático del Costo Unitario / Fraccionado
                              </span>
                              <span className="text-[11px] text-slate-600">
                                Costo Unitario / Fraccionado = (Precio Total del Bulto ÷ Contenido del Bulto)
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-md border border-orange-200">
                            {formatCurrency(bulkPriceNum)} ÷ {bulkContentNum}{' '}
                            {editForm.contentType}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Campo de Solo Lectura — Costo Fraccionado Calculado
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={`Costo por ${singularLabel}: ${formatCurrency(
                              calculatedUnitCost
                            )}`}
                            className="w-full px-4 py-2.5 text-sm sm:text-base font-mono font-extrabold text-slate-900 bg-white border-2 border-[#FF6600] rounded-lg shadow-2xs select-all cursor-default focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* 3. APLICACIÓN EN VENTA POR MENOR / FRACCIONADO */}
                      <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-emerald-200/80 pb-2.5">
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              <Percent className="w-4 h-4 text-emerald-700" />
                              <span>
                                3. Aplicación en Venta por Menor / Fraccionado (por {singularLabel})
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-600">
                              Toma exclusivamente el <strong>Costo por {singularLabel} ({formatCurrency(calculatedUnitCost)})</strong> como costo base minorista.
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-md">
                            Base: {formatCurrency(calculatedUnitCost)} / {shortUnit}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Margen de Ganancia Individual para venta por Unidad/Metro/Kilo/Litro */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Margen de Ganancia Individual (%) — Venta por {singularLabel}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.5"
                                value={editForm.retailMarginPct}
                                onChange={(e) =>
                                  handleEditRetailMarginChange(e.target.value)
                                }
                                className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white text-emerald-800 focus:outline-none focus:border-[#FF6600]"
                              />
                              <span className="text-sm font-mono font-bold text-slate-600">
                                %
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              {[30, 45, 50, 60, 80, 100].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() =>
                                    handleEditRetailMarginChange(String(pct))
                                  }
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                                    Math.round(marginNum) === pct
                                      ? 'bg-emerald-700 text-white border-emerald-700'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  +{pct}%
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Precio de Venta Minorista por Unidad / Metro / Kilo / Litro */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Precio de Venta Minorista por {singularLabel} (ARS) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={editForm.salePrice}
                              onChange={(e) =>
                                handleEditRetailSalePriceChange(e.target.value)
                              }
                              className="w-full px-3.5 py-2 text-sm font-mono font-bold text-[#FF6600] border-2 border-[#FF6600]/60 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                            />
                            <p className="text-[11px] text-slate-600 mt-1 font-mono">
                              Ganancia por {singularLabel}:{' '}
                              <strong className="text-emerald-700">
                                {formatCurrency(unitNetProfit)}
                              </strong>{' '}
                              · Total Bulto Fraccionado:{' '}
                              <strong>
                                {formatCurrency(totalBulkSaleRevenue)}
                              </strong>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 4. Stock actual, Stock mínimo y Control de Stock */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              Control de Stock Activo
                            </span>
                            <p className="text-[11px] text-slate-500">
                              Habilita seguimiento de Stock Actual y alertas de Stock Mínimo
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={editForm.trackStock}
                            onClick={() =>
                              setEditForm((prev) => ({
                                ...prev,
                                trackStock: !prev.trackStock,
                              }))
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                              editForm.trackStock
                                ? 'bg-emerald-600'
                                : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
                                editForm.trackStock
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Stock Actual ({editForm.contentType})
                            </label>
                            <input
                              type="number"
                              disabled={!editForm.trackStock}
                              value={editForm.stock}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  stock: Number(e.target.value),
                                })
                              }
                              className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 focus:outline-none focus:border-[#FF6600]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Stock Mínimo (Alerta Reposición)
                            </label>
                            <input
                              type="number"
                              min={0}
                              disabled={!editForm.trackStock}
                              value={editForm.minStock}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  minStock: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="w-full px-3.5 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 focus:outline-none focus:border-[#FF6600]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* PESTAÑA 3: PROVEEDORES */}
              {editActiveTab === 'proveedores' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Proveedor Principal *
                    </label>
                    <select
                      value={editForm.supplierName}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          supplierName: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                    >
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.name}>
                          {sup.name} (CUIT: {sup.cuit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900">
                          Lista de Proveedores Asociados / Alternativos
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Seleccione los proveedores secundarios que también comercializan este producto.
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono text-xs font-bold">
                        {editForm.associatedSuppliers.length} asociados
                      </span>
                    </div>

                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
                      {suppliers
                        .filter((s) => s.name !== editForm.supplierName)
                        .map((sup) => {
                          const isChecked =
                            editForm.associatedSuppliers.includes(sup.name);
                          return (
                            <label
                              key={sup.id}
                              className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-slate-50 cursor-pointer"
                            >
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {sup.name}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  CUIT {sup.cuit} · {sup.contactPhone}
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEditForm((prev) => ({
                                    ...prev,
                                    associatedSuppliers: checked
                                      ? [...prev.associatedSuppliers, sup.name]
                                      : prev.associatedSuppliers.filter(
                                          (n) => n !== sup.name
                                        ),
                                  }));
                                }}
                                className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                              />
                            </label>
                          );
                        })}
                    </div>

                    {/* Agregar proveedor asociado manual */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newAssocSupplierInput}
                        onChange={(e) =>
                          setNewAssocSupplierInput(e.target.value)
                        }
                        placeholder="Agregar otro proveedor asociado..."
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = newAssocSupplierInput.trim();
                          if (
                            clean &&
                            !editForm.associatedSuppliers.includes(clean)
                          ) {
                            setEditForm((prev) => ({
                              ...prev,
                              associatedSuppliers: [
                                ...prev.associatedSuppliers,
                                clean,
                              ],
                            }));
                            setNewAssocSupplierInput('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        + Asociar
                      </button>
                    </div>

                    {editForm.associatedSuppliers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {editForm.associatedSuppliers.map((supName) => (
                          <span
                            key={supName}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-xs font-semibold text-slate-800"
                          >
                            <Truck className="w-3 h-3 text-[#FF6600]" />
                            <span>{supName}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  associatedSuppliers:
                                    prev.associatedSuppliers.filter(
                                      (s) => s !== supName
                                    ),
                                }))
                              }
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botones Cancelar y Guardar Cambios */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSavingEdit ? 'Guardando Cambios...' : 'Guardar Cambios'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Producto Definitivamente */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Confirmar Eliminación de Producto
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  ¿Estás seguro de que deseas eliminar definitivamente el producto{' '}
                  <strong className="font-semibold text-slate-900">
                    '
                    {productToDelete.name
                      .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
                      .trim()}
                    '
                  </strong>
                  ? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteProduct}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isDeleting ? 'Eliminando...' : 'Sí, eliminar definitivamente'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Ventana Modal de Recepción de Pedido: "¿Llegó el pedido de este producto?" */}
      {receivingOrderProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block">
                    Recepción de Mercadería en Depósito
                  </span>
                  <h3 className="text-base font-bold text-white">
                    ¿Llegó el pedido de este producto?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={isReceivingOrder}
                onClick={() => setReceivingOrderProduct(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Información visible: Nombre del producto, Proveedor asignado y Cantidad solicitada en el pedido original */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Nombre del Producto
                  </span>
                  <p className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    {receivingOrderProduct.name
                      .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
                      .trim()}
                  </p>
                  <span className="text-xs font-mono text-slate-500">
                    Código / SKU: {receivingOrderProduct.sku}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Proveedor Asignado
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Truck className="w-4 h-4 text-[#FF6600] shrink-0" />
                      <span>
                        {receivingOrderProduct.supplierName || 'Proveedor General'}
                      </span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Cantidad Solicitada (Pedido Original)
                    </span>
                    <p className="text-sm sm:text-base font-mono font-extrabold text-indigo-700 mt-0.5">
                      {receivingOrderProduct.orderedQty ?? 0} unidades
                    </p>
                  </div>
                </div>
              </div>

              {/* Campos de entrada: "Cantidad Recibida" y "Stock Mínimo" lado a lado */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-slate-900">
                    Carga de Stock Actual y Stock Mínimo *
                  </label>
                  <span className="text-xs font-mono text-slate-500">
                    Stock actual: <strong>{receivingOrderProduct.stock ?? 0} u.</strong>{' '}
                    → Nuevo stock:{' '}
                    <strong className="text-emerald-700">
                      {(receivingOrderProduct.stock ?? 0) +
                        Math.max(
                          0,
                          Math.round(
                            parseFloat(
                              String(receivedQtyInput || '0').replace(',', '.')
                            ) || 0
                          )
                        )}{' '}
                      u.
                    </strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cantidad Recibida (Stock a Ingresar) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={receivedQtyInput}
                      onChange={(e) => setReceivedQtyInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-base font-mono font-bold text-slate-900 bg-white border-2 border-indigo-500 rounded-xl focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1">
                      Stock Mínimo (Alerta de Reposición)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={receivedMinStockInput}
                      onChange={(e) => setReceivedMinStockInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-base font-mono font-bold text-amber-900 bg-amber-50/40 border-2 border-amber-400 rounded-xl focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Ingrese la cantidad que ingresó al depósito (pedido: {receivingOrderProduct.orderedQty ?? 0} u.) y el Stock Mínimo deseado para alerta de reposición.
                </p>
              </div>

              {/* Aviso de Registro de Movimiento Automático */}
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Se registrará automáticamente en el historial de stock:{' '}
                  <strong>"Ingreso por recepción de pedido de proveedor"</strong>.
                </span>
              </div>

              {/* Opciones / Botones: "Confirmar e Ingresar a Stock", "Recepción Parcial", "Cancelar" */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isReceivingOrder}
                  onClick={() => setReceivingOrderProduct(null)}
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={isReceivingOrder}
                  onClick={() => handleProcessOrderReception('partial')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="Suma las unidades recibidas al stock y mantiene pendiente la diferencia"
                >
                  <Truck className="w-3.5 h-3.5 shrink-0" />
                  <span>Recepción Parcial</span>
                </button>

                <button
                  type="button"
                  disabled={isReceivingOrder}
                  onClick={() => handleProcessOrderReception('complete')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="Suma la cantidad recibida al stock, marca el pedido como Completado/Recibido y remueve el filtro"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {isReceivingOrder
                      ? 'Procesando...'
                      : 'Confirmar e Ingresar a Stock'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal de Historial de Movimientos de Stock ("Ingreso por recepción de pedido de proveedor") */}
      {showStockHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FF6600] flex items-center justify-center text-white shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Historial de Movimientos de Stock
                  </h3>
                  <p className="text-xs text-slate-400">
                    Registro auditado de ingresos por recepción de pedidos de proveedor.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStockHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {stockMovements.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <PackageCheck className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">
                    Aún no se han registrado recepciones de pedidos en esta sesión.
                  </p>
                  <p className="text-xs text-slate-500">
                    Al confirmar o recibir parcialmente un pedido pendiente, se generará automáticamente el movimiento "Ingreso por recepción de pedido de proveedor".
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-3.5">Fecha / Hora</th>
                        <th className="py-2.5 px-3.5">Producto</th>
                        <th className="py-2.5 px-3.5">Proveedor</th>
                        <th className="py-2.5 px-3.5">Detalle del Movimiento</th>
                        <th className="py-2.5 px-3.5 text-right">Cant. Ingresada</th>
                        <th className="py-2.5 px-3.5 text-right">Stock Ant. → Nuevo</th>
                        <th className="py-2.5 px-3.5">Estado del Pedido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {stockMovements.map((mov) => (
                        <tr key={mov.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3.5 font-mono text-slate-500 whitespace-nowrap">
                            {mov.createdAt}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-900">
                              {mov.productName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {mov.sku}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                            {mov.supplierName}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{mov.detail}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            +{mov.receivedQty} u.
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono text-slate-700 whitespace-nowrap">
                            {mov.previousStock} u. →{' '}
                            <strong className="text-slate-900">
                              {mov.newStock} u.
                            </strong>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            {mov.orderStatus === 'Completado/Recibido' ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                Completado/Recibido
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                                Recepción Parcial (Pend: {mov.remainingPendingQty} u.)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStockHistoryModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impresión Rápida de Código de Barras / Etiquetas */}
      <BarcodePrintModal
        product={barcodeModalProduct}
        isOpen={Boolean(barcodeModalProduct)}
        onClose={() => setBarcodeModalProduct(null)}
        formatCurrency={formatCurrency}
      />

      {/* Modal: Nuevo Producto Individual */}
      {newProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Alta de Producto en Maestro
                </h3>
                <p className="text-xs text-slate-500">
                  Configure Código, proveedor habitual, alícuota de IVA y control de stock.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewProductModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSingleProduct} className="space-y-4">
              {/* Manejo de Código / SKU */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-[#FF6600]" />
                      <span>Generar Código automáticamente</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Combina Marca + Categoría + ID correlativo automáticamente
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoGenerateSku}
                    onClick={() => {
                      setAutoGenerateSku((prev) => {
                        const next = !prev;
                        if (!next && !form.sku) {
                          setForm((f) => ({ ...f, sku: generatedSkuPreview }));
                        }
                        return next;
                      });
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      autoGenerateSku ? 'bg-[#FF6600]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        autoGenerateSku ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código del Artículo
                  </label>
                  {autoGenerateSku ? (
                    <div className="w-full px-3 py-2 text-sm font-mono font-semibold text-slate-900 border border-slate-200 rounded-lg bg-white flex items-center justify-between">
                      <span>{generatedSkuPreview}</span>
                      <span className="text-[11px] font-sans font-medium text-[#FF6600]">
                        Autogenerado
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Ingrese Código manual..."
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                    />
                  )}
                </div>
              </div>

              {/* Descripción del Artículo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción / Nombre del Artículo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Taladro Inalámbrico 18V c/ 2 Baterías"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600] focus:bg-white"
                />
              </div>

              {/* Selector de Proveedor Habitual */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proveedor Habitual / Principal
                </label>
                <select
                  value={form.supplierName}
                  onChange={(e) =>
                    setForm({ ...form, supplierName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#FF6600] focus:bg-white"
                >
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name} — CUIT {sup.cuit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Precios y Stock: Costo del Bulto, Fraccionamiento y Venta por Menor */}
              {(() => {
                const newBulkCostNum = Math.max(
                  0,
                  parseFloat(String(form.costPrice || '0').replace(',', '.')) || 0
                );
                const newBulkContentNum = Math.max(
                  0.0001,
                  parseFloat(String(form.bulkContent || '1').replace(',', '.')) || 1
                );
                const newCalculatedUnitCost = calculateUnitFractionalCost(
                  newBulkCostNum,
                  newBulkContentNum
                );
                const newSingularLabel = getSingularContentTypeLabel(
                  form.contentType
                );

                return (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-[#FF6600]" />
                        <span>Precios y Stock (Bulto y Costo Fraccionado)</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-700">
                        1 {form.purchaseUnit} = {form.bulkContent || 1}{' '}
                        {form.contentType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Precio / Costo del Bulto (ARS) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={form.costPrice}
                          onChange={(e) =>
                            handleNewProdBulkCostChange(e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          IVA (%)
                        </label>
                        <select
                          value={form.ivaRate}
                          onChange={(e) =>
                            setForm({ ...form, ivaRate: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        >
                          <option value="21.00">21%</option>
                          <option value="10.50">10.5%</option>
                          <option value="27.00">27%</option>
                          <option value="0.00">0% (Exento)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Unidad de Bulto
                        </label>
                        <select
                          value={form.purchaseUnit}
                          onChange={(e) =>
                            setForm({ ...form, purchaseUnit: e.target.value })
                          }
                          className="w-full px-2.5 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        >
                          {BULK_UNIT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Contenido del Bulto
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={form.bulkContent}
                          onChange={(e) =>
                            handleNewProdBulkContentChange(e.target.value)
                          }
                          className="w-full px-2.5 py-2 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Tipo de Contenido
                        </label>
                        <select
                          value={form.contentType}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              contentType: e.target.value as BulkContentType,
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        >
                          {BULK_CONTENT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Campo de solo lectura con el Costo Unitario / Fraccionado calculado */}
                    <div className="p-2.5 rounded-lg bg-orange-50 border border-[#FF6600]/40">
                      <label className="block text-[10px] font-bold uppercase text-[#FF6600] mb-1">
                        Costo Unitario / Fraccionado (Precio Total del Bulto ÷ Contenido del Bulto)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`Costo por ${newSingularLabel}: ${formatCurrency(
                          newCalculatedUnitCost
                        )}`}
                        className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono font-extrabold text-slate-900 bg-white border border-[#FF6600] rounded-md select-all cursor-default focus:outline-none"
                      />
                    </div>

                    {/* Aplicación en Venta por Menor / Fraccionado */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Margen Venta por {newSingularLabel} (%)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={form.retailMarginPct}
                          onChange={(e) =>
                            handleNewProdRetailMarginChange(e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-mono font-bold text-emerald-700 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Precio Venta por {newSingularLabel}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={form.salePrice}
                          onChange={(e) =>
                            handleNewProdSalePriceChange(e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-mono font-bold text-[#FF6600] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Gestión de Inventario y Alertas (Switch "Lleva control de stock") */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      Lleva control de stock ({form.trackStock ? 'Sí' : 'No — Por Pedido'})
                    </span>
                    <p className="text-[11px] text-slate-500">
                      El artículo permanece en estado "Activo" y permite stock negativo.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.trackStock}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, trackStock: !prev.trackStock }))
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      form.trackStock ? 'bg-[#FF6600]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        form.trackStock ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {form.trackStock ? (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Stock Actual (Permite negativos)
                      </label>
                      <input
                        type="number"
                        required
                        value={form.stock}
                        onChange={(e) =>
                          setForm({ ...form, stock: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Stock Mínimo
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={form.minStock}
                        onChange={(e) =>
                          setForm({ ...form, minStock: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#FF6600]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <span>
                      Artículo Activo configurado como <strong>SOLO POR PEDIDO</strong>.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewProductModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#FF6600] hover:bg-[#E65C00] cursor-pointer"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
