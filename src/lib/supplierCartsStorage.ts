import { SupplierItem } from '../types/ferreteria.ts';

export const SCANNER_SUPPLIER_CARTS_STORAGE_KEY =
  'ferreteria_scanner_supplier_carts_v1';
export const SUPPLIER_CARTS_BY_ID_STORAGE_KEY =
  'ferreteria_supplier_carts_by_id_v2';

export interface PersistentSupplierCartItem {
  productId: number;
  sku: string;
  barcode?: string;
  name: string;
  supplierName: string;
  costPrice: number;
  currentStock: number;
  minStock: number;
  quantity: number;
  addedAt: string;
}

export type SupplierCartsMap = Record<string, PersistentSupplierCartItem[]>;

export function resolveStableSupplierIdByName(
  supName: string,
  suppliers: SupplierItem[] = []
): number {
  if (!supName) return 0;
  const found = suppliers.find(
    (s) => s.name.trim().toLowerCase() === supName.trim().toLowerCase()
  );
  if (found) return found.id;
  let hash = 0;
  const clean = supName.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  return -Math.abs(hash || 999);
}

export function loadSupplierPersistentCartsMap(): SupplierCartsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SCANNER_SUPPLIER_CARTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSupplierPersistentCartsMap(
  carts: SupplierCartsMap,
  suppliers: SupplierItem[] = []
): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Guardar mapa por nombre de proveedor
    const cleanCarts: SupplierCartsMap = {};
    Object.entries(carts).forEach(([supName, list]) => {
      if (Array.isArray(list) && list.length > 0) {
        cleanCarts[supName] = list;
      }
    });
    window.localStorage.setItem(
      SCANNER_SUPPLIER_CARTS_STORAGE_KEY,
      JSON.stringify(cleanCarts)
    );

    // 2. Sincronizar también el mapa por ID de proveedor para que Proveedores y Acciones Rápidas estén 100% unificados
    const rawById = window.localStorage.getItem(
      SUPPLIER_CARTS_BY_ID_STORAGE_KEY
    );
    const existingById: Record<number, any[]> = rawById
      ? JSON.parse(rawById)
      : {};
    const nextById: Record<number, any[]> = {};

    Object.entries(cleanCarts).forEach(([supName, list]) => {
      const supId = resolveStableSupplierIdByName(supName, suppliers);
      if (supId) {
        nextById[supId] = list.map((it) => ({
          productId: it.productId,
          sku: it.sku,
          name: it.name,
          currentStock: it.currentStock,
          minStock: it.minStock,
          quantity: it.quantity,
          unitCost: it.costPrice,
        }));
      }
    });

    // Si algún proveedor tenía carrito en existingById pero fue vaciado en cleanCarts, no se copia
    window.localStorage.setItem(
      SUPPLIER_CARTS_BY_ID_STORAGE_KEY,
      JSON.stringify(nextById)
    );

    window.dispatchEvent(new CustomEvent('supplier-carts-updated'));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Devuelve un mapa { [productId]: { totalQty, supplierName } } con todos los productos
 * actualmente presentes en cualquier carrito persistente de proveedor.
 */
export function getProductsInSupplierCartsLookup(): Record<
  number,
  { quantity: number; supplierName: string }
> {
  if (typeof window === 'undefined') return {};
  const lookup: Record<number, { quantity: number; supplierName: string }> = {};
  try {
    const byName = loadSupplierPersistentCartsMap();
    Object.entries(byName).forEach(([supName, items]) => {
      if (!Array.isArray(items)) return;
      items.forEach((it) => {
        const pid = Number(it.productId);
        const qty = Number(it.quantity) || 0;
        if (pid && qty > 0) {
          lookup[pid] = {
            quantity: (lookup[pid]?.quantity || 0) + qty,
            supplierName: supName,
          };
        }
      });
    });

    // También revisar por ID por si algún ítem solo estaba en SUPPLIER_CARTS_BY_ID_STORAGE_KEY
    const rawById = window.localStorage.getItem(
      SUPPLIER_CARTS_BY_ID_STORAGE_KEY
    );
    if (rawById) {
      const parsedById = JSON.parse(rawById);
      if (parsedById && typeof parsedById === 'object') {
        Object.values(parsedById).forEach((items: any) => {
          if (!Array.isArray(items)) return;
          items.forEach((it: any) => {
            const pid = Number(it.productId);
            const qty = Number(it.quantity) || 0;
            if (pid && qty > 0 && !lookup[pid]) {
              lookup[pid] = {
                quantity: qty,
                supplierName: String(it.supplierName || 'Proveedor'),
              };
            }
          });
        });
      }
    }
  } catch {
    // ignore
  }
  return lookup;
}

/**
 * Devuelve un resumen de cuántos carritos activos e ítems totales existen.
 */
export function getActiveSupplierCartsSummary(): {
  activeSuppliersCount: number;
  totalItemsCount: number;
  totalUnitsCount: number;
} {
  const lookup = loadSupplierPersistentCartsMap();
  let activeSuppliersCount = 0;
  let totalItemsCount = 0;
  let totalUnitsCount = 0;

  Object.values(lookup).forEach((items) => {
    if (Array.isArray(items) && items.length > 0) {
      activeSuppliersCount += 1;
      totalItemsCount += items.length;
      totalUnitsCount += items.reduce(
        (acc, it) => acc + (Number(it.quantity) || 0),
        0
      );
    }
  });

  return { activeSuppliersCount, totalItemsCount, totalUnitsCount };
}
