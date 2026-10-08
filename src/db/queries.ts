import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_FILE_PATH = path.resolve(__dirname, '../../.data/ferreteria-store.json');

export interface StoreUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: string;
  activeBranchId: number;
  createdAt: string;
}

export interface StoreBranch {
  id: number;
  name: string;
  companyName: string;
  cuit: string;
  address: string;
  pointOfSaleNumber: string;
  isActive: boolean;
}

export interface StoreProduct {
  id: number;
  sku: string;
  name: string;
  category: string;
  brand: string;
  supplierName: string;
  costPrice: string;
  ivaRate: string;
  salePrice: string;
  cardPrice?: string;
  purchaseUnit?: string;
  unitsPerPackage?: number;
  trackStock: boolean;
  hadStock: boolean;
  orderedQty: number;
  stock: number;
  minStock: number;
  suggestedStock: number;
  status: string;
  meliSynced: boolean;
  meliStatus: string;
  updatedAt: string;
}

export interface StoreDocument {
  id: number;
  docType: string;
  docNumber: string;
  clientName: string;
  clientCuit: string;
  branchName: string;
  sellerName: string;
  totalAmount: string;
  itemsCount: number;
  status: string;
  createdAt: string;
}

export interface StoreClient {
  id: number;
  name: string;
  cuit: string;
  dni?: string;
  taxCondition: string;
  phone: string;
  email: string;
  balance: string;
  priceList: string;
}

export interface StoreSupplier {
  id: number;
  name: string;
  cuit: string;
  category: string;
  contactPhone: string;
  email: string;
  address?: string;
  notes?: string;
  lastPriceUpdate: string;
  balance: string;
  status: string;
}

export interface StoreScannerAuditLog {
  id: number;
  operatorName: string;
  actionType: string;
  actionDetail: string;
  referenceCode: string;
  targetName: string;
  branchName: string;
  createdAt: string;
}

export interface WorkspaceStoreData {
  storeVersion?: string;
  users: StoreUser[];
  branches: StoreBranch[];
  products: StoreProduct[];
  documents: StoreDocument[];
  clients: StoreClient[];
  suppliers: StoreSupplier[];
  scannerAuditLogs: StoreScannerAuditLog[];
}

const CURRENT_STORE_VERSION = 'v2-blank-system';

function createInitialBlankData(superAdminOverride?: {
  name?: string;
  email?: string;
}): WorkspaceStoreData {
  const nowIso = new Date().toISOString();
  return {
    storeVersion: CURRENT_STORE_VERSION,
    users: [
      {
        id: 1,
        uid: 'superadmin-root',
        email:
          superAdminOverride?.email ||
          'martin.gomez@ferreteriadelpuente.com.ar',
        name: superAdminOverride?.name || 'Martín Gómez',
        role: 'Super Administrador — Control Total del Sistema',
        activeBranchId: 1,
        createdAt: nowIso,
      },
    ],
    branches: [
      {
        id: 1,
        name: 'Sucursal Central — Av. San Martín 1450',
        companyName: 'FERRETERIA DEL PUENTE S.R.L.',
        cuit: '30-71458920-9',
        address: 'Av. San Martín 1450, Avellaneda, Buenos Aires',
        pointOfSaleNumber: '0004',
        isActive: true,
      },
      {
        id: 2,
        name: 'Corralón y Depósito Industrial — Ruta 4 Km 12',
        companyName: 'FERRETERIA DEL PUENTE S.R.L.',
        cuit: '30-71458920-9',
        address: 'Camino de Cintura (Ruta 4) Km 12.5, Zona Sur',
        pointOfSaleNumber: '0005',
        isActive: true,
      },
      {
        id: 3,
        name: 'Sucursal Norte — Av. Maipú 2840',
        companyName: 'FERRETERIA DEL PUENTE S.R.L.',
        cuit: '30-71458920-9',
        address: 'Av. Maipú 2840, Olivos, Buenos Aires',
        pointOfSaleNumber: '0006',
        isActive: true,
      },
    ],
    products: [],
    clients: [],
    suppliers: [],
    documents: [],
    scannerAuditLogs: [],
  };
}

let memoryStore: WorkspaceStoreData | null = null;

export function getStore(): WorkspaceStoreData {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const raw = fs.readFileSync(STORE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.storeVersion === CURRENT_STORE_VERSION &&
        Array.isArray(parsed.products) &&
        Array.isArray(parsed.branches)
      ) {
        memoryStore = {
          storeVersion: CURRENT_STORE_VERSION,
          users: Array.isArray(parsed.users) ? parsed.users : [],
          branches: parsed.branches,
          products: parsed.products,
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          clients: Array.isArray(parsed.clients) ? parsed.clients : [],
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
          scannerAuditLogs: Array.isArray(parsed.scannerAuditLogs)
            ? parsed.scannerAuditLogs
            : [],
        };
        return memoryStore;
      }
    }
  } catch (err) {
    console.warn('Could not read local store file, using blank store:', err);
  }

  memoryStore = createInitialBlankData();
  saveStore();
  return memoryStore;
}

export function saveStore(): void {
  if (!memoryStore) return;
  try {
    const dir = path.dirname(STORE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch {
    // Ignore read-only filesystem errors in serverless environments; memoryStore stays authoritative
  }
}

export async function resetStoreToFactory(superAdminOverride?: {
  name?: string;
  email?: string;
}) {
  const currentBranches = memoryStore?.branches;
  const fresh = createInitialBlankData(superAdminOverride);
  if (Array.isArray(currentBranches) && currentBranches.length > 0) {
    fresh.branches = currentBranches;
  }
  memoryStore = fresh;
  saveStore();
  return memoryStore;
}

export async function updatePrimaryBranchCompanyData(input: {
  companyName?: string;
  cuit?: string;
  address?: string;
  pointOfSaleNumber?: string;
}) {
  const store = getStore();
  for (const b of store.branches) {
    if (input.companyName) b.companyName = String(input.companyName).trim();
    if (input.cuit) b.cuit = String(input.cuit).trim();
  }
  if (store.branches[0]) {
    if (input.address) {
      store.branches[0].address = String(input.address).trim();
      store.branches[0].name = `Sucursal Central — ${String(input.address).trim()}`;
    }
    if (input.pointOfSaleNumber) {
      store.branches[0].pointOfSaleNumber = String(input.pointOfSaleNumber).trim();
    }
  }
  saveStore();
  return store.branches;
}

export async function getAllBranches() {
  const store = getStore();
  return [...store.branches].sort((a, b) => a.id - b.id);
}

export async function getAllDocuments() {
  const store = getStore();
  return [...store.documents].sort((a, b) => b.id - a.id);
}

export async function getAllProducts() {
  const store = getStore();
  return [...store.products].sort((a, b) => b.id - a.id);
}

export async function getAllClients() {
  const store = getStore();
  return [...store.clients].sort((a, b) => a.id - b.id);
}

export async function getAllSuppliers() {
  const store = getStore();
  return [...store.suppliers].sort((a, b) => b.id - a.id);
}

export async function createDocumentRecord(input: {
  docType: string;
  docNumber: string;
  clientName: string;
  clientCuit: string;
  branchName: string;
  sellerName: string;
  totalAmount: string;
  itemsCount: number;
  status: string;
}) {
  const store = getStore();
  const nextId =
    store.documents.reduce((max, d) => Math.max(max, Number(d.id) || 0), 0) + 1;
  const created: StoreDocument = {
    id: nextId,
    docType: input.docType,
    docNumber: input.docNumber,
    clientName: input.clientName,
    clientCuit: input.clientCuit,
    branchName: input.branchName,
    sellerName: input.sellerName,
    totalAmount: input.totalAmount,
    itemsCount: input.itemsCount,
    status: input.status,
    createdAt: new Date().toISOString(),
  };
  store.documents.push(created);
  saveStore();
  return created;
}

export async function updateDocumentStatusRecord(id: number, status: string) {
  const store = getStore();
  const doc = store.documents.find((d) => d.id === Number(id));
  if (!doc) {
    throw new Error('Comprobante no encontrado.');
  }
  doc.status = status;
  saveStore();
  return doc;
}

export async function updateProductInlineStockRecord(
  id: number,
  input: {
    trackStock?: boolean;
    controla_stock?: boolean;
    stock: number;
    minStock: number;
    suggestedStock?: number;
    status?: string;
  }
) {
  const store = getStore();
  const prevRow = store.products.find((p) => p.id === Number(id));
  if (!prevRow) {
    throw new Error('Producto no encontrado en la base de datos.');
  }

  const rawTrack =
    input.trackStock !== undefined
      ? input.trackStock
      : input.controla_stock !== undefined
      ? input.controla_stock
      : true;
  const trackStockVal = Boolean(rawTrack);

  const parsedStock = Number(input.stock);
  const stockVal = trackStockVal
    ? Number.isFinite(parsedStock)
      ? Math.trunc(parsedStock)
      : 0
    : 0;
  const parsedMinStock = Number(input.minStock);
  const minStockVal = trackStockVal
    ? Number.isFinite(parsedMinStock)
      ? Math.max(0, Math.trunc(parsedMinStock))
      : 0
    : 0;

  const parsedSuggested =
    input.suggestedStock !== undefined
      ? Number(input.suggestedStock)
      : prevRow.suggestedStock ?? 0;
  const suggestedStockVal = trackStockVal
    ? Number.isFinite(parsedSuggested)
      ? Math.max(0, Math.trunc(parsedSuggested))
      : 0
    : 0;

  const previousHadStock =
    Boolean(prevRow.hadStock) ||
    Boolean(prevRow.trackStock) ||
    (prevRow.stock ?? 0) > 0;
  const hadStockVal = previousHadStock || stockVal > 0 || trackStockVal;

  const stockWasManuallyUpdated = stockVal !== prevRow.stock;
  const nextOrderedQty = stockWasManuallyUpdated ? 0 : prevRow.orderedQty ?? 0;

  const commercialStatus = !trackStockVal
    ? 'Inactivo'
    : input.status === 'Inactivo'
    ? 'Inactivo'
    : 'Activo';

  prevRow.trackStock = trackStockVal;
  prevRow.hadStock = hadStockVal;
  prevRow.orderedQty = nextOrderedQty;
  prevRow.stock = stockVal;
  prevRow.minStock = minStockVal;
  prevRow.suggestedStock = suggestedStockVal;
  prevRow.status = commercialStatus;
  prevRow.updatedAt = new Date().toISOString();

  saveStore();
  return prevRow;
}

export async function receiveProductOrderRecord(
  id: number,
  input: {
    receivedQty: number;
    mode: 'complete' | 'partial';
  }
) {
  const store = getStore();
  const prev = store.products.find((p) => p.id === Number(id));
  if (!prev) {
    throw new Error('Producto no encontrado en la base de datos.');
  }

  const currentStock = prev.stock ?? 0;
  const currentOrdered = Math.max(0, prev.orderedQty ?? 0);
  const received = Math.max(1, Math.trunc(Number(input.receivedQty) || 1));

  const nextStock = currentStock + received;
  const nextOrderedQty =
    input.mode === 'complete' ? 0 : Math.max(0, currentOrdered - received);

  prev.trackStock = true;
  prev.hadStock = true;
  prev.stock = nextStock;
  prev.orderedQty = nextOrderedQty;
  prev.status = 'Activo';
  prev.updatedAt = new Date().toISOString();

  saveStore();
  return prev;
}

export async function deleteProductRecord(id: number) {
  const store = getStore();
  const idx = store.products.findIndex((p) => p.id === Number(id));
  if (idx === -1) {
    throw new Error('Producto no encontrado.');
  }
  const [deleted] = store.products.splice(idx, 1);
  saveStore();
  return deleted;
}

export async function updateProductRecord(
  id: number,
  input: {
    sku?: string;
    name?: string;
    category?: string;
    brand?: string;
    supplierName?: string;
    costPrice?: string | number;
    ivaRate?: string | number;
    salePrice?: string | number;
    trackStock?: boolean;
    stock?: number;
    minStock?: number;
    suggestedStock?: number;
    status?: string;
  }
) {
  const store = getStore();
  const prev = store.products.find((p) => p.id === Number(id));
  if (!prev) {
    throw new Error('Producto no encontrado en la base de datos.');
  }

  const cleanSku = input.sku
    ? String(input.sku).trim().toUpperCase()
    : prev.sku;
  const cleanName = input.name
    ? String(input.name)
        .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
        .trim()
    : prev.name;
  const cleanCategory = input.category
    ? String(input.category).trim()
    : prev.category;
  const cleanBrand = input.brand ? String(input.brand).trim() : prev.brand;
  const cleanSupplier = input.supplierName
    ? String(input.supplierName).trim()
    : prev.supplierName;

  const costNum =
    input.costPrice !== undefined &&
    Number.isFinite(parseFloat(String(input.costPrice)))
      ? parseFloat(String(input.costPrice))
      : parseFloat(String(prev.costPrice || '0')) || 0;

  const ivaNum =
    input.ivaRate !== undefined &&
    Number.isFinite(parseFloat(String(input.ivaRate)))
      ? parseFloat(String(input.ivaRate))
      : parseFloat(String(prev.ivaRate || '21')) || 21;

  const saleNum =
    input.salePrice !== undefined &&
    Number.isFinite(parseFloat(String(input.salePrice)))
      ? parseFloat(String(input.salePrice))
      : parseFloat(String(prev.salePrice || '0')) || 0;

  const isEditingStockFields =
    input.stock !== undefined ||
    input.minStock !== undefined ||
    input.suggestedStock !== undefined;
  const explicitTrack =
    (input as any).controla_stock !== undefined
      ? Boolean((input as any).controla_stock)
      : input.trackStock !== undefined
      ? Boolean(input.trackStock)
      : undefined;

  const trackStockVal =
    explicitTrack !== undefined
      ? explicitTrack
      : isEditingStockFields
      ? true
      : prev.trackStock;
  const parsedStock =
    input.stock !== undefined ? Number(input.stock) : prev.stock;
  const stockVal = trackStockVal
    ? Number.isFinite(parsedStock)
      ? Math.trunc(parsedStock)
      : 0
    : 0;
  const parsedMin =
    input.minStock !== undefined ? Number(input.minStock) : prev.minStock;
  const minStockVal = trackStockVal
    ? Number.isFinite(parsedMin)
      ? Math.max(0, Math.trunc(parsedMin))
      : 0
    : 0;
  const parsedSuggested =
    input.suggestedStock !== undefined
      ? Number(input.suggestedStock)
      : prev.suggestedStock ?? 0;
  const suggestedStockVal = trackStockVal
    ? Number.isFinite(parsedSuggested)
      ? Math.max(0, Math.trunc(parsedSuggested))
      : 0
    : 0;

  const hadStockVal = Boolean(prev.hadStock) || stockVal > 0 || trackStockVal;
  const stockChanged = stockVal !== prev.stock;
  const nextOrderedQty = stockChanged ? 0 : prev.orderedQty ?? 0;

  const commercialStatus = !trackStockVal
    ? 'Inactivo'
    : input.status === 'Inactivo'
    ? 'Inactivo'
    : 'Activo';

  prev.sku = cleanSku;
  prev.name = cleanName;
  prev.category = cleanCategory;
  prev.brand = cleanBrand;
  prev.supplierName = cleanSupplier;
  prev.costPrice = costNum.toFixed(2);
  prev.ivaRate = ivaNum.toFixed(2);
  prev.salePrice = saleNum.toFixed(2);
  prev.trackStock = trackStockVal;
  prev.hadStock = hadStockVal;
  prev.orderedQty = nextOrderedQty;
  prev.stock = stockVal;
  prev.minStock = minStockVal;
  prev.suggestedStock = suggestedStockVal;
  prev.status = commercialStatus;
  prev.updatedAt = new Date().toISOString();

  saveStore();
  return prev;
}

export interface ProductUpsertInput {
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  supplierName?: string;
  costPrice: string;
  ivaRate?: string;
  salePrice?: string;
  cardPrice?: string;
  purchaseUnit?: string;
  unitsPerPackage?: number;
  trackStock?: boolean;
  stock?: number;
  minStock?: number;
  status?: string;
}

export async function bulkUpsertProductsRecord(items: ProductUpsertInput[]) {
  const store = getStore();
  const insertedOrUpdated: StoreProduct[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.name) continue;

    const brandClean = String(item.brand || 'Genérico').trim();
    const catClean = String(item.category || 'Ferretería General').trim();
    const brandPrefix = brandClean
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, 'X');
    const catPrefix = catClean
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, 'G');

    const cleanSku =
      String(item.sku || '').trim().toUpperCase() ||
      `${brandPrefix}-${catPrefix}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const trackStockVal =
      item.trackStock !== undefined ? Boolean(item.trackStock) : true;
    const parsedStock = Number(item.stock);
    const stockVal = trackStockVal
      ? Number.isFinite(parsedStock)
        ? Math.trunc(parsedStock)
        : 0
      : 0;
    const parsedMin = Number(item.minStock);
    const minStockVal = trackStockVal
      ? Number.isFinite(parsedMin)
        ? Math.max(0, Math.trunc(parsedMin))
        : 0
      : 0;

    const commercialStatus = !trackStockVal
      ? 'Inactivo'
      : item.status === 'Inactivo'
      ? 'Inactivo'
      : 'Activo';

    const costNumeric = Number.isFinite(parseFloat(String(item.costPrice)))
      ? parseFloat(String(item.costPrice))
      : 0;
    const costVal = costNumeric.toFixed(2);

    const unitsPerPkg =
      item.unitsPerPackage && Number(item.unitsPerPackage) > 0
        ? Math.max(1, Number(item.unitsPerPackage))
        : 1;
    const unitCostBase = costNumeric / unitsPerPkg;

    const ivaNumeric = Number.isFinite(parseFloat(String(item.ivaRate)))
      ? parseFloat(String(item.ivaRate))
      : 21;
    const ivaVal = ivaNumeric.toFixed(2);

    const saleNumeric =
      item.salePrice !== undefined &&
      Number.isFinite(parseFloat(String(item.salePrice))) &&
      parseFloat(String(item.salePrice)) > 0
        ? parseFloat(String(item.salePrice))
        : unitCostBase * 1.45;
    const saleVal = saleNumeric.toFixed(2);

    const cardNumeric =
      item.cardPrice !== undefined &&
      Number.isFinite(parseFloat(String(item.cardPrice))) &&
      parseFloat(String(item.cardPrice)) > 0
        ? parseFloat(String(item.cardPrice))
        : saleNumeric * 1.15;
    const cardVal = cardNumeric.toFixed(2);

    const purchaseUnitVal = item.purchaseUnit
      ? String(item.purchaseUnit).trim().toUpperCase()
      : 'CAJA';

    const supplierClean = String(
      item.supplierName || 'Distribuidora Herramientas Argentinas S.A.'
    ).trim();

    const cleanProductName = String(item.name)
      .replace(/\s*\[Costo Neto[^\]]*\]/gi, '')
      .trim();

    const hadStockVal = stockVal > 0 || trackStockVal;

    const existing = store.products.find(
      (p) => p.sku.toUpperCase() === cleanSku
    );
    if (existing) {
      existing.name = cleanProductName;
      existing.category = catClean;
      existing.brand = brandClean;
      existing.supplierName = supplierClean;
      existing.costPrice = costVal;
      existing.ivaRate = ivaVal;
      existing.salePrice = saleVal;
      existing.cardPrice = cardVal;
      existing.purchaseUnit = purchaseUnitVal;
      existing.unitsPerPackage = unitsPerPkg;
      existing.trackStock = trackStockVal;
      existing.hadStock = hadStockVal;
      existing.orderedQty = 0;
      existing.stock = stockVal;
      existing.minStock = minStockVal;
      existing.status = commercialStatus;
      existing.updatedAt = new Date().toISOString();
      insertedOrUpdated.push(existing);
    } else {
      const nextId =
        store.products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) +
        1;
      const created: StoreProduct = {
        id: nextId,
        sku: cleanSku,
        name: cleanProductName,
        category: catClean,
        brand: brandClean,
        supplierName: supplierClean,
        costPrice: costVal,
        ivaRate: ivaVal,
        salePrice: saleVal,
        cardPrice: cardVal,
        purchaseUnit: purchaseUnitVal,
        unitsPerPackage: unitsPerPkg,
        trackStock: trackStockVal,
        hadStock: hadStockVal,
        orderedQty: 0,
        stock: stockVal,
        minStock: minStockVal,
        suggestedStock: Math.max(minStockVal * 2, 10),
        status: commercialStatus,
        meliSynced: false,
        meliStatus: 'Sin publicar',
        updatedAt: new Date().toISOString(),
      };
      store.products.push(created);
      insertedOrUpdated.push(created);
    }
  }

  saveStore();
  return insertedOrUpdated;
}

export interface BatchProductUpdateItem {
  id: number;
  sku?: string;
  name?: string;
  category?: string;
  brand?: string;
  supplierName?: string;
  costPrice?: string | number;
  ivaRate?: string | number;
  salePrice?: string | number;
  cardPrice?: string | number;
  purchaseUnit?: string;
  unitsPerPackage?: number;
  stock?: number;
  minStock?: number;
  trackStock?: boolean;
}

export async function batchUpdateProductsRecord(items: BatchProductUpdateItem[]) {
  const store = getStore();
  const updatedList: StoreProduct[] = [];

  for (const item of items) {
    const existing = store.products.find((p) => p.id === Number(item.id));
    if (!existing) continue;

    if (item.sku !== undefined && String(item.sku).trim()) {
      existing.sku = String(item.sku).trim().toUpperCase();
    }
    if (item.name !== undefined && String(item.name).trim()) {
      existing.name = String(item.name).trim();
    }
    if (item.category !== undefined && String(item.category).trim()) {
      existing.category = String(item.category).trim();
    }
    if (item.brand !== undefined && String(item.brand).trim()) {
      existing.brand = String(item.brand).trim();
    }
    if (item.supplierName !== undefined && String(item.supplierName).trim()) {
      existing.supplierName = String(item.supplierName).trim();
    }
    if (
      item.costPrice !== undefined &&
      Number.isFinite(parseFloat(String(item.costPrice)))
    ) {
      existing.costPrice = Math.max(
        0,
        parseFloat(String(item.costPrice))
      ).toFixed(2);
    }
    if (
      item.ivaRate !== undefined &&
      Number.isFinite(parseFloat(String(item.ivaRate)))
    ) {
      existing.ivaRate = Math.max(0, parseFloat(String(item.ivaRate))).toFixed(2);
    }
    if (
      item.salePrice !== undefined &&
      Number.isFinite(parseFloat(String(item.salePrice)))
    ) {
      existing.salePrice = Math.max(
        0,
        parseFloat(String(item.salePrice))
      ).toFixed(2);
    }
    if (
      item.cardPrice !== undefined &&
      Number.isFinite(parseFloat(String(item.cardPrice)))
    ) {
      existing.cardPrice = Math.max(
        0,
        parseFloat(String(item.cardPrice))
      ).toFixed(2);
    }
    if (item.purchaseUnit !== undefined && String(item.purchaseUnit).trim()) {
      existing.purchaseUnit = String(item.purchaseUnit).trim().toUpperCase();
    }
    if (
      item.unitsPerPackage !== undefined &&
      Number.isFinite(Number(item.unitsPerPackage))
    ) {
      existing.unitsPerPackage = Math.max(1, Number(item.unitsPerPackage));
    }
    if (item.stock !== undefined && Number.isFinite(Number(item.stock))) {
      existing.stock = Math.max(0, Math.trunc(Number(item.stock)));
      existing.trackStock = true;
      existing.hadStock = true;
    }
    if (item.minStock !== undefined && Number.isFinite(Number(item.minStock))) {
      existing.minStock = Math.max(0, Math.trunc(Number(item.minStock)));
    }
    existing.updatedAt = new Date().toISOString();
    updatedList.push(existing);
  }

  saveStore();
  return updatedList;
}

export interface ProductCostOnlyUpdateInput {
  id?: number;
  sku: string;
  costPrice: string | number;
  ivaRate?: string | number;
  salePrice?: string | number;
}

export async function bulkUpdateProductCostsOnlyRecord(
  items: ProductCostOnlyUpdateInput[],
  supplierId?: number,
  lastPriceUpdateLabel?: string
) {
  const store = getStore();
  const updatedProducts: StoreProduct[] = [];

  for (const item of items) {
    const cleanSku = String(item.sku || '').trim().toUpperCase();
    if (!cleanSku && !item.id) continue;

    const existing = item.id
      ? store.products.find((p) => p.id === Number(item.id))
      : store.products.find((p) => p.sku.toUpperCase() === cleanSku);

    if (!existing) continue;

    const prevCost = parseFloat(String(existing.costPrice || '0')) || 0;
    const prevSale = parseFloat(String(existing.salePrice || '0')) || 0;
    const marginRatio =
      prevCost > 0 && prevSale > 0 ? prevSale / prevCost : 1.45;

    const nextCostNum = Number.isFinite(parseFloat(String(item.costPrice)))
      ? Math.max(0, parseFloat(String(item.costPrice)))
      : prevCost;

    const nextIvaNum =
      item.ivaRate !== undefined &&
      Number.isFinite(parseFloat(String(item.ivaRate)))
        ? Math.max(0, parseFloat(String(item.ivaRate)))
        : parseFloat(String(existing.ivaRate || '21')) || 21;

    const nextSaleNum =
      item.salePrice !== undefined &&
      Number.isFinite(parseFloat(String(item.salePrice))) &&
      parseFloat(String(item.salePrice)) > 0
        ? parseFloat(String(item.salePrice))
        : nextCostNum * marginRatio;

    existing.costPrice = nextCostNum.toFixed(2);
    existing.ivaRate = nextIvaNum.toFixed(2);
    existing.salePrice = nextSaleNum.toFixed(2);
    existing.updatedAt = new Date().toISOString();
    updatedProducts.push(existing);
  }

  if (supplierId && Number(supplierId) > 0) {
    const sup = store.suppliers.find((s) => s.id === Number(supplierId));
    if (sup) {
      sup.lastPriceUpdate =
        lastPriceUpdateLabel || 'Costos actualizados hoy (Lista 3 col.)';
    }
  }

  saveStore();
  return updatedProducts;
}

export interface SupplierImportInput {
  name: string;
  cuit: string;
  category?: string;
  contactPhone: string;
  email: string;
  address?: string;
  notes?: string;
  lastPriceUpdate?: string;
  balance?: string;
  status?: string;
}

export async function bulkInsertSuppliersRecord(items: SupplierImportInput[]) {
  const store = getStore();
  const processed: StoreSupplier[] = [];

  for (const item of items) {
    const cleanName = String(item.name || '').trim();
    const cleanCuit = String(item.cuit || '').trim();
    if (!cleanName) continue;

    const balanceNum = Number.isFinite(parseFloat(String(item.balance)))
      ? parseFloat(String(item.balance))
      : 0;
    const balanceStr = balanceNum.toFixed(2);
    const computedStatus =
      item.status || (balanceNum > 0 ? 'Saldo Pendiente' : 'Al día');

    const existing = cleanCuit
      ? store.suppliers.find((s) => s.cuit === cleanCuit)
      : store.suppliers.find(
          (s) => s.name.toLowerCase() === cleanName.toLowerCase()
        );

    if (existing) {
      existing.name = cleanName;
      existing.category = String(
        item.category || existing.category || 'Ferretería General'
      ).trim();
      existing.contactPhone = String(
        item.contactPhone || existing.contactPhone || '-'
      ).trim();
      existing.email = String(
        item.email || existing.email || 'contacto@proveedor.com.ar'
      ).trim();
      if (item.address !== undefined) {
        existing.address = String(item.address).trim();
      }
      if (item.notes !== undefined) {
        existing.notes = String(item.notes).trim();
      }
      existing.balance = balanceStr;
      existing.status = computedStatus;
      existing.lastPriceUpdate =
        item.lastPriceUpdate || 'Importado hoy (Excel/CSV)';
      processed.push(existing);
    } else {
      const nextId =
        store.suppliers.reduce(
          (max, s) => Math.max(max, Number(s.id) || 0),
          0
        ) + 1;
      const inserted: StoreSupplier = {
        id: nextId,
        name: cleanName,
        cuit: cleanCuit || '30-00000000-0',
        category: String(item.category || 'Insumos y Ferretería').trim(),
        contactPhone: String(item.contactPhone || '+54 11 4000-0000').trim(),
        email: String(item.email || 'ventas@proveedor.com.ar').trim(),
        address: item.address ? String(item.address).trim() : '',
        notes: item.notes ? String(item.notes).trim() : '',
        lastPriceUpdate: item.lastPriceUpdate || 'Importado hoy (Excel/CSV)',
        balance: balanceStr,
        status: computedStatus,
      };
      store.suppliers.push(inserted);
      processed.push(inserted);
    }
  }

  saveStore();
  return processed;
}

export async function recordSupplierPaymentRecord(input: {
  supplierId: number;
  amount: number;
  paymentMethod: string;
}) {
  const store = getStore();
  const sup = store.suppliers.find((s) => s.id === Number(input.supplierId));
  if (!sup) {
    throw new Error('Proveedor no encontrado.');
  }

  const currentBalance = parseFloat(String(sup.balance || '0')) || 0;
  const paidAmount = Math.max(0, Number(input.amount) || 0);
  const nextBalance = currentBalance - paidAmount;
  const nextStatus =
    nextBalance > 0.009
      ? 'Saldo Pendiente'
      : nextBalance < -0.009
      ? 'Saldo a Favor'
      : 'Al día';

  sup.balance = nextBalance.toFixed(2);
  sup.status = nextStatus;
  sup.lastPriceUpdate = `Pago (${input.paymentMethod}) registrado hoy`;

  saveStore();
  return sup;
}

export async function recordSupplierOrderRecord(input: {
  supplierId: number;
  totalAmount: number;
  items?: { productId: number; quantity: number }[];
}) {
  const store = getStore();
  const sup = store.suppliers.find((s) => s.id === Number(input.supplierId));
  if (!sup) {
    throw new Error('Proveedor no encontrado.');
  }

  const currentBalance = parseFloat(String(sup.balance || '0')) || 0;
  const orderTotal = Math.max(0, Number(input.totalAmount) || 0);
  const nextBalance = currentBalance + orderTotal;
  const nextStatus =
    nextBalance > 0.009
      ? 'Saldo Pendiente'
      : nextBalance < -0.009
      ? 'Saldo a Favor'
      : 'Al día';

  sup.balance = nextBalance.toFixed(2);
  sup.status = nextStatus;
  sup.lastPriceUpdate = 'Orden de Compra emitida hoy';

  if (Array.isArray(input.items) && input.items.length > 0) {
    for (const item of input.items) {
      const prodId = Number(item.productId);
      const qty = Math.max(1, Math.trunc(Number(item.quantity) || 1));
      if (!prodId) continue;

      const prod = store.products.find((p) => p.id === prodId);
      if (prod) {
        const currentOrdered = prod.orderedQty ?? 0;
        prod.orderedQty = currentOrdered + qty;
        prod.updatedAt = new Date().toISOString();
      }
    }
  }

  saveStore();
  return sup;
}

export async function recordSupplierReturnRecord(input: {
  supplierId: number;
  reason: string;
  items: { productId: number; quantity: number; unitCost: number }[];
}) {
  const store = getStore();
  const sup = store.suppliers.find((s) => s.id === Number(input.supplierId));
  if (!sup) {
    throw new Error('Proveedor no encontrado.');
  }

  let totalCredit = 0;

  for (const item of input.items) {
    const qty = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const unitCost = Math.max(0, Number(item.unitCost) || 0);
    totalCredit += qty * unitCost;

    const prod = store.products.find((p) => p.id === Number(item.productId));
    if (prod) {
      const nextStock = (prod.stock ?? 0) - qty;
      prod.stock = nextStock;
      prod.hadStock = Boolean(prod.hadStock) || (prod.stock ?? 0) > 0;
      prod.updatedAt = new Date().toISOString();
    }
  }

  const currentBalance = parseFloat(String(sup.balance || '0')) || 0;
  const nextBalance = currentBalance - totalCredit;
  const nextStatus =
    nextBalance > 0.009
      ? 'Saldo Pendiente'
      : nextBalance < -0.009
      ? 'Saldo a Favor'
      : 'Al día';

  sup.balance = nextBalance.toFixed(2);
  sup.status = nextStatus;
  sup.lastPriceUpdate = `Devolución (${input.reason}) acreditada hoy`;

  saveStore();
  return {
    updatedSupplier: sup,
    totalCredit,
  };
}

export async function createClientRecord(input: {
  name: string;
  cuit: string;
  taxCondition: string;
  phone: string;
  email: string;
  balance?: string | number;
  priceList: string;
}) {
  const store = getStore();
  const cleanBalance = Number.isFinite(parseFloat(String(input.balance)))
    ? parseFloat(String(input.balance)).toFixed(2)
    : '0.00';

  const nextId =
    store.clients.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;

  const created: StoreClient = {
    id: nextId,
    name: String(input.name || '').trim(),
    cuit: String(input.cuit || '').trim(),
    taxCondition: String(input.taxCondition || 'Responsable Inscripto').trim(),
    phone: String(input.phone || '-').trim(),
    email: String(input.email || '-').trim(),
    balance: cleanBalance,
    priceList: String(input.priceList || 'Efectivo / Contado').trim(),
  };

  store.clients.push(created);
  saveStore();
  return created;
}

export interface ClientImportInput {
  name: string;
  phone?: string;
  cuit?: string;
  dni?: string;
  balance?: string | number;
  taxCondition?: string;
  email?: string;
  priceList?: string;
}

export async function bulkInsertClientsRecord(items: ClientImportInput[]) {
  const store = getStore();
  const processed: StoreClient[] = [];

  for (const item of items) {
    const cleanName = String(item.name || '').trim();
    if (!cleanName) continue;

    const cleanCuit = String(item.cuit || '').trim();
    const cleanDni = String(item.dni || '').trim();
    const finalCuitOrDni = cleanCuit || cleanDni || '00-00000000-0';

    const balanceNum = Number.isFinite(parseFloat(String(item.balance)))
      ? Math.max(0, parseFloat(String(item.balance)))
      : 0;
    const balanceStr = balanceNum.toFixed(2);

    const existing = store.clients.find(
      (c) =>
        (cleanCuit && c.cuit === cleanCuit) ||
        c.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existing) {
      existing.name = cleanName;
      existing.cuit = finalCuitOrDni;
      if (cleanDni) existing.dni = cleanDni;
      if (item.phone) existing.phone = String(item.phone).trim();
      existing.balance = balanceStr;
      processed.push(existing);
    } else {
      const nextId =
        store.clients.reduce(
          (max, c) => Math.max(max, Number(c.id) || 0),
          0
        ) + 1;
      const inserted: StoreClient = {
        id: nextId,
        name: cleanName,
        cuit: finalCuitOrDni,
        dni: cleanDni || undefined,
        taxCondition: String(
          item.taxCondition ||
            (cleanCuit.startsWith('30') || cleanCuit.startsWith('33')
              ? 'Responsable Inscripto'
              : 'Consumidor Final')
        ).trim(),
        phone: String(item.phone || '-').trim(),
        email: String(item.email || '-').trim(),
        balance: balanceStr,
        priceList: String(item.priceList || 'Efectivo / Contado').trim(),
      };
      store.clients.push(inserted);
      processed.push(inserted);
    }
  }

  saveStore();
  return processed;
}

export async function updateClientRecord(
  id: number,
  input: {
    name?: string;
    cuit?: string;
    taxCondition?: string;
    phone?: string;
    email?: string;
    balance?: string | number;
    priceList?: string;
  }
) {
  const store = getStore();
  const prev = store.clients.find((c) => c.id === Number(id));
  if (!prev) {
    throw new Error('Cliente no encontrado.');
  }

  const nextBalance =
    input.balance !== undefined &&
    Number.isFinite(parseFloat(String(input.balance)))
      ? parseFloat(String(input.balance)).toFixed(2)
      : prev.balance;

  prev.name = input.name ? String(input.name).trim() : prev.name;
  prev.cuit = input.cuit ? String(input.cuit).trim() : prev.cuit;
  prev.taxCondition = input.taxCondition
    ? String(input.taxCondition).trim()
    : prev.taxCondition;
  prev.phone =
    input.phone !== undefined ? String(input.phone).trim() : prev.phone;
  prev.email =
    input.email !== undefined ? String(input.email).trim() : prev.email;
  prev.balance = nextBalance;
  prev.priceList = input.priceList
    ? String(input.priceList).trim()
    : prev.priceList;

  saveStore();
  return prev;
}

export async function deleteClientRecord(id: number) {
  const store = getStore();
  const idx = store.clients.findIndex((c) => c.id === Number(id));
  if (idx === -1) {
    throw new Error('Cliente no encontrado.');
  }
  const [deleted] = store.clients.splice(idx, 1);
  saveStore();
  return deleted;
}

export async function adjustClientBalanceRecord(
  id: number,
  deltaAmount: number
) {
  const store = getStore();
  const prev = store.clients.find((c) => c.id === Number(id));
  if (!prev) {
    throw new Error('Cliente no encontrado.');
  }
  const currentBal = parseFloat(String(prev.balance || '0')) || 0;
  const nextBal = Math.max(0, currentBal + deltaAmount);
  prev.balance = nextBal.toFixed(2);
  saveStore();
  return prev;
}

export async function recordPosSaleCheckoutRecord(input: {
  docNumber: string;
  docType: string;
  clientId?: number | null;
  clientName: string;
  clientCuit: string;
  branchName: string;
  sellerName: string;
  paymentMethod: string;
  totalAmount: number;
  status?: string;
  items: { productId: number; quantity: number }[];
}) {
  const store = getStore();
  const itemsCount = input.items.reduce(
    (acc, it) => acc + Math.max(1, Math.trunc(Number(it.quantity) || 1)),
    0
  );

  const createdDocument = await createDocumentRecord({
    docNumber: String(
      input.docNumber || `FAC-0004-${Date.now().toString().slice(-6)}`
    ),
    docType: String(input.docType || 'Factura B'),
    clientName: String(input.clientName || 'Consumidor Final'),
    clientCuit: String(input.clientCuit || '00-00000000-0'),
    branchName: String(input.branchName || 'Sucursal Central'),
    sellerName: String(input.sellerName || 'Mostrador'),
    itemsCount: Math.max(1, itemsCount),
    totalAmount: Math.max(0, Number(input.totalAmount) || 0).toFixed(2),
    status: String(input.status || 'Emitido'),
  });

  if (input.docType !== 'Presupuesto') {
    for (const item of input.items) {
      const prodId = Number(item.productId);
      const qty = Math.max(1, Math.trunc(Number(item.quantity) || 1));
      if (!prodId || prodId <= 0) continue;

      const prod = store.products.find((p) => p.id === prodId);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock ?? 0) - qty);
        prod.hadStock = true;
        prod.updatedAt = new Date().toISOString();
      }
    }
  }

  if (
    input.paymentMethod === 'Cuenta Corriente' &&
    input.clientId &&
    Number(input.totalAmount) > 0 &&
    input.docType !== 'Presupuesto'
  ) {
    await adjustClientBalanceRecord(
      Number(input.clientId),
      Number(input.totalAmount)
    );
  }

  saveStore();
  return createdDocument;
}

export async function receivePurchaseInvoiceRecord(input: {
  supplierId?: number | null;
  invoiceNumber: string;
  invoiceType?: string;
  addToSupplierBalance?: boolean;
  updateProductCosts?: boolean;
  items: { productId: number; quantity: number; unitCost: number }[];
}) {
  const store = getStore();
  let invoiceTotal = 0;

  for (const item of input.items) {
    const prodId = Number(item.productId);
    const qty = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const unitCost = Math.max(0, Number(item.unitCost) || 0);
    if (!prodId) continue;

    invoiceTotal += qty * unitCost;

    const prod = store.products.find((p) => p.id === prodId);
    if (prod) {
      const nextStock = (prod.stock ?? 0) + qty;
      const nextOrdered = Math.max(0, (prod.orderedQty ?? 0) - qty);

      let nextCostStr = prod.costPrice;
      let nextSaleStr = prod.salePrice;

      if (input.updateProductCosts && unitCost > 0) {
        const oldCost = parseFloat(String(prod.costPrice)) || 0;
        const oldSale = parseFloat(String(prod.salePrice)) || 0;
        const ratio =
          oldCost > 0 && oldSale >= oldCost ? oldSale / oldCost : 1.45;
        nextCostStr = unitCost.toFixed(2);
        nextSaleStr = (unitCost * ratio).toFixed(2);
      }

      prod.stock = nextStock;
      prod.hadStock = true;
      prod.orderedQty = nextOrdered;
      prod.costPrice = nextCostStr;
      prod.salePrice = nextSaleStr;
      prod.updatedAt = new Date().toISOString();
    }
  }

  if (input.supplierId && input.addToSupplierBalance && invoiceTotal > 0) {
    const sup = store.suppliers.find((s) => s.id === Number(input.supplierId));
    if (sup) {
      const prevBal = parseFloat(String(sup.balance || '0')) || 0;
      const nextBal = prevBal + invoiceTotal;
      const nextStatus =
        nextBal > 0.009
          ? 'Saldo Pendiente'
          : nextBal < -0.009
          ? 'Saldo a Favor'
          : 'Al día';

      sup.balance = nextBal.toFixed(2);
      sup.status = nextStatus;
      sup.lastPriceUpdate = `Factura Compra ${input.invoiceNumber} recibida hoy`;
    }
  }

  saveStore();
  return { invoiceTotal };
}

export async function getAllScannerAuditLogs() {
  const store = getStore();
  return [...store.scannerAuditLogs]
    .sort((a, b) => b.id - a.id)
    .slice(0, 100);
}

export async function createScannerAuditLogRecord(input: {
  operatorName: string;
  actionType: string;
  actionDetail: string;
  referenceCode?: string;
  targetName?: string;
  branchName?: string;
}) {
  const store = getStore();
  const nextId =
    store.scannerAuditLogs.reduce(
      (max, l) => Math.max(max, Number(l.id) || 0),
      0
    ) + 1;
  const created: StoreScannerAuditLog = {
    id: nextId,
    operatorName: input.operatorName || 'Operador Móvil',
    actionType: input.actionType || 'Carga de Stock',
    actionDetail: input.actionDetail,
    referenceCode: input.referenceCode || '-',
    targetName: input.targetName || '-',
    branchName: input.branchName || 'Sucursal Central',
    createdAt: new Date().toISOString(),
  };
  store.scannerAuditLogs.push(created);
  saveStore();
  return created;
}
