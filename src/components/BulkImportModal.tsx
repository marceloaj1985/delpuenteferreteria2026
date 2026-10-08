import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Download,
  Sparkles,
  Plus,
  Calculator,
  Percent,
  Truck,
  Users,
  Package,
} from 'lucide-react';
import { SupplierItem, ProductItem, ClientItem } from '../types/ferreteria.ts';
import {
  saveProductExtendedMeta,
  enrichProductWithExtendedMeta,
  loadProductExtendedMetaMap,
} from './ProductsModule.tsx';

export type ImportEntityMode = 'products' | 'suppliers' | 'clients';
export type BulkImportMode = ImportEntityMode;

interface BulkImportModalProps {
  mode: ImportEntityMode;
  isOpen: boolean;
  onClose: () => void;
  suppliers?: SupplierItem[];
  onSupplierQuickCreated?: (
    updatedSuppliers: SupplierItem[],
    createdName: string
  ) => void;
  onSuccess: (
    importedCount: number,
    updatedList: any[],
    summaryMessage?: string,
    entityMode?: ImportEntityMode
  ) => void;
}

interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
}

/**
 * Columnas estándar para Plantilla Productos:
 * CODIGO_SKU, NOMBRE, UNIDAD_EMPAQUE (Caja/Rollo/Paquete), UNIDADES_POR_BULTO,
 * PRECIO_COSTO_BULTO, PRECIO_EFECTIVO_UNIDAD, PRECIO_TARJETA_UNIDAD, STOCK, CATEGORIA, MARCA, PROVEEDOR
 */
const PRODUCT_FIELDS: FieldDefinition[] = [
  {
    key: 'sku',
    label: 'CODIGO_SKU',
    required: true,
    synonyms: [
      'codigo_sku',
      'código_sku',
      'codigo sku',
      'código sku',
      'sku',
      'codigo',
      'código',
      'código de proveedor',
      'codigo de proveedor',
      'cod',
    ],
  },
  {
    key: 'name',
    label: 'NOMBRE',
    required: true,
    synonyms: [
      'nombre',
      'descripcion',
      'descripción',
      'producto',
      'detalle',
      'articulo',
      'artículo',
    ],
  },
  {
    key: 'purchaseUnit',
    label: 'UNIDAD_EMPAQUE (Caja/Rollo/Paquete)',
    required: false,
    synonyms: [
      'unidad_empaque',
      'unidad_empaque (caja/rollo/paquete)',
      'unidad empaque',
      'empaque',
      'tipo empaque',
      'bulto',
      'unidad de compra',
    ],
  },
  {
    key: 'unitsPerPackage',
    label: 'UNIDADES_POR_BULTO',
    required: false,
    synonyms: [
      'unidades_por_bulto',
      'unidades por bulto',
      'unidades x bulto',
      'cantidad por bulto',
      'unidades empaque',
      'fraccionamiento',
    ],
  },
  {
    key: 'costPrice',
    label: 'PRECIO_COSTO_BULTO',
    required: true,
    synonyms: [
      'precio_costo_bulto',
      'precio costo bulto',
      'costo bulto',
      'costo',
      'precio costo',
      'costo_bulto',
      'precio compra',
    ],
  },
  {
    key: 'salePrice',
    label: 'PRECIO_EFECTIVO_UNIDAD',
    required: false,
    synonyms: [
      'precio_efectivo_unidad',
      'precio efectivo unidad',
      'precio efectivo',
      'precio venta',
      'efectivo',
      'contado',
      'venta',
    ],
  },
  {
    key: 'cardPrice',
    label: 'PRECIO_TARJETA_UNIDAD',
    required: false,
    synonyms: [
      'precio_tarjeta_unidad',
      'precio tarjeta unidad',
      'precio tarjeta',
      'tarjeta',
      'precio lista',
    ],
  },
  {
    key: 'stock',
    label: 'STOCK',
    required: false,
    synonyms: ['stock', 'stock actual', 'existencia', 'cantidad', 'disponible'],
  },
  {
    key: 'category',
    label: 'CATEGORIA',
    required: false,
    synonyms: ['categoria', 'categoría', 'rubro', 'familia'],
  },
  {
    key: 'brand',
    label: 'MARCA',
    required: false,
    synonyms: ['marca', 'fabricante', 'brand'],
  },
  {
    key: 'supplierName',
    label: 'PROVEEDOR',
    required: false,
    synonyms: ['proveedor', 'razon social proveedor', 'distribuidor'],
  },
];

/**
 * Columnas por defecto para Plantilla Proveedores:
 * RAZON SOCIAL, CUIT, TELEFONO, EMAIL, DIRECCION, NOTAS
 */
const SUPPLIER_FIELDS: FieldDefinition[] = [
  {
    key: 'name',
    label: 'RAZON SOCIAL',
    required: true,
    synonyms: [
      'razon social',
      'razón social',
      'nombre',
      'proveedor',
      'empresa',
      'firma',
    ],
  },
  {
    key: 'cuit',
    label: 'CUIT',
    required: true,
    synonyms: ['cuit', 'cuil', 'cuit/cuil', 'identificacion fiscal'],
  },
  {
    key: 'contactPhone',
    label: 'TELEFONO',
    required: false,
    synonyms: ['telefono', 'teléfono', 'whatsapp', 'celular', 'tel', 'contacto'],
  },
  {
    key: 'email',
    label: 'EMAIL',
    required: false,
    synonyms: ['email', 'correo', 'mail', 'e-mail'],
  },
  {
    key: 'address',
    label: 'DIRECCION',
    required: false,
    synonyms: ['direccion', 'dirección', 'domicilio', 'calle', 'localidad'],
  },
  {
    key: 'notes',
    label: 'NOTAS',
    required: false,
    synonyms: ['notas', 'observaciones', 'comentarios', 'detalle'],
  },
];

/**
 * Columnas exactas para Plantilla Clientes:
 * NOMBRE, TELEFONO, CUIT, DNI, DEUDA TOTAL
 */
const CLIENT_FIELDS: FieldDefinition[] = [
  {
    key: 'name',
    label: 'NOMBRE',
    required: true,
    synonyms: [
      'nombre',
      'razon social',
      'razón social',
      'cliente',
      'nombre y apellido',
    ],
  },
  {
    key: 'phone',
    label: 'TELEFONO',
    required: false,
    synonyms: ['telefono', 'teléfono', 'whatsapp', 'celular', 'tel'],
  },
  {
    key: 'cuit',
    label: 'CUIT',
    required: false,
    synonyms: ['cuit', 'cuil', 'cuit/cuil'],
  },
  {
    key: 'dni',
    label: 'DNI',
    required: false,
    synonyms: ['dni', 'documento', 'nro documento'],
  },
  {
    key: 'balance',
    label: 'DEUDA TOTAL',
    required: false,
    synonyms: [
      'deuda total',
      'deuda_total',
      'deuda',
      'saldo',
      'saldo actual',
      'cuenta corriente',
      'balance',
    ],
  },
];

export const SAMPLE_PRODUCTS_TEMPLATE_ROWS = [
  {
    CODIGO_SKU: 'TOR-HEX-38',
    NOMBRE: 'Bulón Hexagonal Zincado 3/8 x 2"',
    UNIDAD_EMPAQUE: 'Caja',
    UNIDADES_POR_BULTO: 200,
    PRECIO_COSTO_BULTO: 34000,
    PRECIO_EFECTIVO_UNIDAD: 250,
    PRECIO_TARJETA_UNIDAD: 290,
    STOCK: 400,
    CATEGORIA: 'Bulonería y Fijaciones',
    MARCA: 'El Tornillo',
    PROVEEDOR: 'Distribuidora Industrial El Tornillo S.R.L.',
  },
  {
    CODIGO_SKU: 'PRY-25MM-R100',
    NOMBRE: 'Cable Unipolar Normalizado 2.5mm',
    UNIDAD_EMPAQUE: 'Rollo',
    UNIDADES_POR_BULTO: 100,
    PRECIO_COSTO_BULTO: 48500,
    PRECIO_EFECTIVO_UNIDAD: 710,
    PRECIO_TARJETA_UNIDAD: 820,
    STOCK: 500,
    CATEGORIA: 'Electricidad e Iluminación',
    MARCA: 'Prysmian',
    PROVEEDOR: 'Importadora Herramientas del Sur S.A.',
  },
  {
    CODIGO_SKU: 'MAK-DISC-115',
    NOMBRE: 'Disco de Corte Fino Acero Inox 115mm',
    UNIDAD_EMPAQUE: 'Paquete',
    UNIDADES_POR_BULTO: 25,
    PRECIO_COSTO_BULTO: 31250,
    PRECIO_EFECTIVO_UNIDAD: 1850,
    PRECIO_TARJETA_UNIDAD: 2150,
    STOCK: 150,
    CATEGORIA: 'Abrasivos y Discos',
    MARCA: 'Makita',
    PROVEEDOR: 'Importadora Herramientas del Sur S.A.',
  },
];

export const SAMPLE_SUPPLIERS_TEMPLATE_ROWS = [
  {
    'RAZON SOCIAL': 'Distribuidora Industrial El Tornillo S.R.L.',
    CUIT: '30-71239841-5',
    TELEFONO: '+54 11 4582-9910',
    EMAIL: 'ventas@eltornillosrl.com.ar',
    DIRECCION: 'Av. Mitre 2450, Avellaneda',
    NOTAS: 'Entregas martes y jueves. Descuento 5% pago contado.',
  },
  {
    'RAZON SOCIAL': 'Importadora Herramientas del Sur S.A.',
    CUIT: '30-68912044-9',
    TELEFONO: '+54 11 5231-4400',
    EMAIL: 'cobranzas@herramientasdelsur.com.ar',
    DIRECCION: 'Parque Industrial Norte Ruta 9 Km 34',
    NOTAS: 'Proveedor oficial línea eléctrica y abrasivos.',
  },
  {
    'RAZON SOCIAL': 'Pinturerías y Químicos del Oeste S.A.',
    CUIT: '33-70845120-9',
    TELEFONO: '+54 11 4629-1800',
    EMAIL: 'pedidos@quimicosdeloeste.com.ar',
    DIRECCION: 'Camino de Cintura 1820, Morón',
    NOTAS: 'Cuenta corriente a 30 días fecha factura.',
  },
];

export const SAMPLE_CLIENTS_TEMPLATE_ROWS = [
  {
    NOMBRE: 'Constructora Río de la Plata S.A.',
    TELEFONO: '+54 11 4800-3300',
    CUIT: '30-68912044-2',
    DNI: '',
    'DEUDA TOTAL': 185000,
  },
  {
    NOMBRE: 'Carlos Alberto Méndez (Instalador)',
    TELEFONO: '+54 11 6120-8840',
    CUIT: '20-28451920-3',
    DNI: '28451920',
    'DEUDA TOTAL': 42500,
  },
  {
    NOMBRE: 'Herrería y Estructuras El Puente S.R.L.',
    TELEFONO: '+54 11 4201-7711',
    CUIT: '30-71449012-8',
    DNI: '',
    'DEUDA TOTAL': 0,
  },
];

/**
 * Función exportada para descargar directamente la Plantilla Base de Clientes, Proveedores o Productos
 * en formato Excel (.xlsx) o CSV (.csv) desde cualquier módulo.
 */
export function downloadBaseEntityTemplate(
  entity: ImportEntityMode,
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  let worksheet: XLSX.WorkSheet;
  let sheetName: string;
  let baseFileName: string;

  if (entity === 'clients') {
    worksheet = XLSX.utils.json_to_sheet(SAMPLE_CLIENTS_TEMPLATE_ROWS, {
      header: ['NOMBRE', 'TELEFONO', 'CUIT', 'DNI', 'DEUDA TOTAL'],
    });
    sheetName = 'Plantilla_Clientes';
    baseFileName = 'plantilla_base_clientes';
  } else if (entity === 'suppliers') {
    worksheet = XLSX.utils.json_to_sheet(SAMPLE_SUPPLIERS_TEMPLATE_ROWS, {
      header: [
        'RAZON SOCIAL',
        'CUIT',
        'TELEFONO',
        'EMAIL',
        'DIRECCION',
        'NOTAS',
      ],
    });
    sheetName = 'Plantilla_Proveedores';
    baseFileName = 'plantilla_base_proveedores';
  } else {
    worksheet = XLSX.utils.json_to_sheet(SAMPLE_PRODUCTS_TEMPLATE_ROWS, {
      header: [
        'CODIGO_SKU',
        'NOMBRE',
        'UNIDAD_EMPAQUE',
        'UNIDADES_POR_BULTO',
        'PRECIO_COSTO_BULTO',
        'PRECIO_EFECTIVO_UNIDAD',
        'PRECIO_TARJETA_UNIDAD',
        'STOCK',
        'CATEGORIA',
        'MARCA',
        'PROVEEDOR',
      ],
    });
    sheetName = 'Plantilla_Productos';
    baseFileName = 'plantilla_base_productos';
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  if (format === 'xlsx') {
    XLSX.writeFile(workbook, `${baseFileName}.xlsx`);
  } else {
    XLSX.writeFile(workbook, `${baseFileName}.csv`, { bookType: 'csv' });
  }
}

export const downloadEntityTemplate = downloadBaseEntityTemplate;

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  mode,
  isOpen,
  onClose,
  suppliers = [],
  onSupplierQuickCreated,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMode, setActiveMode] = useState<ImportEntityMode>(mode);
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Opciones adicionales para productos
  const [costIncludesIva, setCostIncludesIva] = useState<boolean>(true);
  const [commercialDiscount, setCommercialDiscount] = useState<string>('0');
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
  const [quickSupplierOpen, setQuickSupplierOpen] = useState<boolean>(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState<boolean>(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: '',
    cuit: '',
    contactPhone: '',
  });

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setRawHeaders([]);
      setRawRows([]);
      setFileName('');
      setColumnMap({});
    }
  }, [isOpen, activeMode]);

  if (!isOpen) return null;

  const fields =
    activeMode === 'products'
      ? PRODUCT_FIELDS
      : activeMode === 'suppliers'
      ? SUPPLIER_FIELDS
      : CLIENT_FIELDS;

  const autoMapColumns = (
    headers: string[],
    targetMode: ImportEntityMode = activeMode
  ) => {
    const activeFields =
      targetMode === 'products'
        ? PRODUCT_FIELDS
        : targetMode === 'suppliers'
        ? SUPPLIER_FIELDS
        : CLIENT_FIELDS;

    const newMap: Record<string, string> = {};
    activeFields.forEach((field) => {
      const matched = headers.find((h) => {
        const cleanH = h.trim().toLowerCase();
        return (
          cleanH === field.key.toLowerCase() ||
          cleanH === field.label.toLowerCase() ||
          field.synonyms.some((syn) => cleanH === syn || cleanH.includes(syn))
        );
      });
      if (matched) {
        newMap[field.key] = matched;
      }
    });
    setColumnMap(newMap);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: '',
      });

      if (jsonData.length === 0) {
        setErrorMsg(
          'El archivo seleccionado está vacío o no contiene filas válidas.'
        );
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setFileName(file.name);
      setRawHeaders(headers);
      setRawRows(jsonData);
      autoMapColumns(headers, activeMode);
    } catch (err) {
      console.error('Error parsing Excel/CSV file:', err);
      setErrorMsg(
        'No se pudo leer el archivo. Asegúrese de subir un archivo .xlsx o .csv válido.'
      );
    }
  };

  const handleLoadSampleData = () => {
    setErrorMsg(null);
    const sample =
      activeMode === 'products'
        ? SAMPLE_PRODUCTS_TEMPLATE_ROWS
        : activeMode === 'suppliers'
        ? SAMPLE_SUPPLIERS_TEMPLATE_ROWS
        : SAMPLE_CLIENTS_TEMPLATE_ROWS;
    const headers = Object.keys(sample[0]);
    setFileName(
      activeMode === 'products'
        ? 'plantilla_base_productos.xlsx'
        : activeMode === 'suppliers'
        ? 'plantilla_base_proveedores.xlsx'
        : 'plantilla_base_clientes.xlsx'
    );
    setRawHeaders(headers);
    setRawRows(sample);
    autoMapColumns(headers, activeMode);
  };

  const parseNumberClean = (val: any): number => {
    if (typeof val === 'number') return val;
    const str = String(val ?? '')
      .replace(/\$/g, '')
      .replace(/%/g, '')
      .replace(/\s/g, '')
      .replace(',', '.');
    const num = parseFloat(str);
    return Number.isFinite(num) ? num : NaN;
  };

  const formatMoney = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '$ 0,00';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const handleQuickCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierForm.name.trim()) return;
    setIsCreatingSupplier(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: quickSupplierForm.name.trim(),
        cuit: quickSupplierForm.cuit.trim() || '30-00000000-0',
        contactPhone:
          quickSupplierForm.contactPhone.trim() || '+54 11 4000-0000',
        email: 'ventas@proveedor.com.ar',
        category: 'Ferretería General',
        balance: '0.00',
        status: 'Al día',
      };
      const res = await fetch('/api/suppliers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [payload] }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || 'Error al crear proveedor rápido');

      const createdName = quickSupplierForm.name.trim();
      setSelectedSupplierName(createdName);
      setQuickSupplierOpen(false);
      setQuickSupplierForm({ name: '', cuit: '', contactPhone: '' });
      if (onSupplierQuickCreated && data.suppliers) {
        onSupplierQuickCreated(data.suppliers, createdName);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo crear el proveedor.');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  const discountVal = Math.max(
    0,
    Math.min(100, parseFloat(commercialDiscount.replace(',', '.')) || 0)
  );

  const missingRequiredColumns = fields
    .filter((f) => f.required && !columnMap[f.key])
    .map((f) => f.label);

  const mappedItems = rawRows.map((row, rowIndex) => {
    if (activeMode === 'products') {
      const rawSku = columnMap.sku
        ? String(row[columnMap.sku] ?? '').trim()
        : '';
      const rawName = columnMap.name
        ? String(row[columnMap.name] ?? '').trim()
        : '';
      const rawPackage = columnMap.purchaseUnit
        ? String(row[columnMap.purchaseUnit] ?? '').trim()
        : 'Caja';
      const rawUnitsPerPkg = columnMap.unitsPerPackage
        ? parseNumberClean(row[columnMap.unitsPerPackage])
        : 1;
      const unitsPerPackage =
        Number.isFinite(rawUnitsPerPkg) && rawUnitsPerPkg > 0
          ? Math.max(1, Math.round(rawUnitsPerPkg))
          : 1;

      const rawBulkCost = columnMap.costPrice
        ? parseNumberClean(row[columnMap.costPrice])
        : NaN;
      const discountedBulkCost = Number.isFinite(rawBulkCost)
        ? rawBulkCost * (1 - discountVal / 100)
        : 0;
      const finalBulkCost = costIncludesIva
        ? discountedBulkCost
        : discountedBulkCost * 1.21;

      const unitCostCalc = finalBulkCost / unitsPerPackage;

      const rawCashPrice = columnMap.salePrice
        ? parseNumberClean(row[columnMap.salePrice])
        : NaN;
      const finalCashPrice =
        Number.isFinite(rawCashPrice) && rawCashPrice > 0
          ? rawCashPrice
          : unitCostCalc * 1.45;

      const rawCardPrice = columnMap.cardPrice
        ? parseNumberClean(row[columnMap.cardPrice])
        : NaN;
      const finalCardPrice =
        Number.isFinite(rawCardPrice) && rawCardPrice > 0
          ? rawCardPrice
          : finalCashPrice * 1.15;

      const rawStock = columnMap.stock
        ? parseNumberClean(row[columnMap.stock])
        : 0;
      const stock = Number.isFinite(rawStock) ? Math.max(0, Math.round(rawStock)) : 0;

      const category =
        (columnMap.category
          ? String(row[columnMap.category] ?? '').trim()
          : '') || 'Ferretería General';
      const brand =
        (columnMap.brand ? String(row[columnMap.brand] ?? '').trim() : '') ||
        'Genérica';
      const rowSupplier = columnMap.supplierName
        ? String(row[columnMap.supplierName] ?? '').trim()
        : '';
      const finalSupplier =
        rowSupplier || selectedSupplierName || 'Proveedor General';

      const normalizedUnit = rawPackage
        ? rawPackage.toUpperCase()
        : 'CAJA';

      return {
        rowNumber: rowIndex + 2,
        sku: rawSku || `ART-${1000 + rowIndex}`,
        barcode: rawSku || `ART-${1000 + rowIndex}`,
        name: rawName,
        purchaseUnit: normalizedUnit,
        unitsPerPackage,
        costPrice: finalBulkCost.toFixed(2),
        unitFractionalCost: unitCostCalc,
        salePrice: finalCashPrice.toFixed(2),
        cardPrice: finalCardPrice.toFixed(2),
        ivaRate: '21.00',
        trackStock: true,
        stock,
        minStock: Math.max(2, Math.round(stock * 0.2)),
        category,
        brand,
        supplierName: finalSupplier,
        status: 'Activo',
        isValid: Boolean(rawName && Number.isFinite(rawBulkCost)),
      };
    }

    if (activeMode === 'suppliers') {
      const name = columnMap.name
        ? String(row[columnMap.name] ?? '').trim()
        : '';
      const cuit = columnMap.cuit
        ? String(row[columnMap.cuit] ?? '').trim()
        : '';
      const contactPhone = columnMap.contactPhone
        ? String(row[columnMap.contactPhone] ?? '').trim()
        : '-';
      const email = columnMap.email
        ? String(row[columnMap.email] ?? '').trim()
        : '-';
      const address = columnMap.address
        ? String(row[columnMap.address] ?? '').trim()
        : '';
      const notes = columnMap.notes
        ? String(row[columnMap.notes] ?? '').trim()
        : '';

      return {
        rowNumber: rowIndex + 2,
        name,
        cuit: cuit || '30-00000000-0',
        contactPhone,
        email,
        address,
        notes,
        balance: '0.00',
        status: 'Al día',
        category: notes || 'Ferretería e Insumos',
        isValid: Boolean(name),
      };
    }

    // activeMode === 'clients'
    const name = columnMap.name
      ? String(row[columnMap.name] ?? '').trim()
      : '';
    const phone = columnMap.phone
      ? String(row[columnMap.phone] ?? '').trim()
      : '-';
    const cuit = columnMap.cuit
      ? String(row[columnMap.cuit] ?? '').trim()
      : '';
    const dni = columnMap.dni ? String(row[columnMap.dni] ?? '').trim() : '';
    const debtParsed = columnMap.balance
      ? parseNumberClean(row[columnMap.balance])
      : 0;
    const balanceNum = Number.isFinite(debtParsed) ? Math.max(0, debtParsed) : 0;

    return {
      rowNumber: rowIndex + 2,
      name,
      phone: phone || '-',
      cuit: cuit || dni || '00-00000000-0',
      dni,
      balance: balanceNum.toFixed(2),
      taxCondition:
        cuit.startsWith('30') || cuit.startsWith('33')
          ? 'Responsable Inscripto'
          : 'Consumidor Final',
      priceList: 'Efectivo / Contado',
      isValid: Boolean(name),
    };
  });

  const validMappedItems = mappedItems.filter((item: any) => item.isValid);

  const canConfirmImport =
    validMappedItems.length > 0 &&
    missingRequiredColumns.length === 0 &&
    !isSubmitting;

  const handleConfirmImport = async () => {
    if (missingRequiredColumns.length > 0) {
      setErrorMsg(
        `Faltan mapear columnas obligatorias: ${missingRequiredColumns.join(', ')}.`
      );
      return;
    }
    if (validMappedItems.length === 0) {
      setErrorMsg('No se encontraron filas válidas para importar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const endpoint =
        activeMode === 'products'
          ? '/api/products/bulk'
          : activeMode === 'suppliers'
          ? '/api/suppliers/bulk'
          : '/api/clients/bulk';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validMappedItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al insertar registros.');
      }

      if (activeMode === 'products') {
        const returnedProducts: ProductItem[] = Array.isArray(data.products)
          ? data.products
          : [];
        let currentMetaMap = loadProductExtendedMetaMap();
        validMappedItems.forEach((importedItem: any) => {
          const matchedProd = returnedProducts.find(
            (p) =>
              p.sku.trim().toLowerCase() ===
              String(importedItem.sku || '').trim().toLowerCase()
          );
          if (matchedProd) {
            currentMetaMap = saveProductExtendedMeta(matchedProd.id, {
              barcode: String(importedItem.barcode || importedItem.sku).trim(),
              purchaseUnit: importedItem.purchaseUnit,
              unitsPerPackage: importedItem.unitsPerPackage,
              unitFractionalCost: importedItem.unitFractionalCost,
              cardPrice: importedItem.cardPrice,
            });
          }
        });

        const enrichedProducts = returnedProducts.map((p) =>
          enrichProductWithExtendedMeta(p, currentMetaMap)
        );
        const totalCount = data.importedCount || validMappedItems.length;
        onSuccess(
          totalCount,
          enrichedProducts,
          `Importación masiva exitosa: ${totalCount} productos importados con cálculo de bulto/unidad.`,
          'products'
        );
        onClose();
      } else if (activeMode === 'suppliers') {
        const updatedSuppliers: SupplierItem[] = data.suppliers || [];
        const totalCount = data.importedCount || validMappedItems.length;
        onSuccess(
          totalCount,
          updatedSuppliers,
          `Importación masiva exitosa: ${totalCount} proveedores procesados en la base de datos.`,
          'suppliers'
        );
        onClose();
      } else {
        const updatedClients: ClientItem[] = data.clients || [];
        const totalCount = data.importedCount || validMappedItems.length;
        onSuccess(
          totalCount,
          updatedClients,
          `Importación masiva exitosa: ${totalCount} clientes registrados con su saldo/deuda total.`,
          'clients'
        );
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar los datos importados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modeTitle =
    activeMode === 'products'
      ? 'Importar Productos (Con Empaque / Bulto y Precios)'
      : activeMode === 'suppliers'
      ? 'Importar Proveedores (Padrón Comercial)'
      : 'Importar Clientes (Padrón y Deuda Total)';

  const modeColumnsText =
    activeMode === 'products'
      ? 'CODIGO_SKU · NOMBRE · UNIDAD_EMPAQUE (Caja/Rollo/Paquete) · UNIDADES_POR_BULTO · PRECIO_COSTO_BULTO · PRECIO_EFECTIVO_UNIDAD · PRECIO_TARJETA_UNIDAD · STOCK · CATEGORIA · MARCA · PROVEEDOR'
      : activeMode === 'suppliers'
      ? 'RAZON SOCIAL · CUIT · TELEFONO · EMAIL · DIRECCION · NOTAS'
      : 'NOMBRE · TELEFONO · CUIT · DNI · DEUDA TOTAL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        {/* Modal Header + Selector de Entidad */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6600] text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {modeTitle}
              </h3>
              <p className="text-xs text-slate-300">
                Descargue la plantilla base en Excel (.xlsx) o CSV (.csv), complete sus filas y suba el archivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector rápido entre las 3 entidades */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveMode('suppliers')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  activeMode === 'suppliers'
                    ? 'bg-[#FF6600] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Proveedores</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('products')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  activeMode === 'products'
                    ? 'bg-[#FF6600] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Productos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('clients')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  activeMode === 'clients'
                    ? 'bg-[#FF6600] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Clientes</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs sm:text-sm font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-900">
                  Error en la validación de importación
                </div>
                <div className="mt-0.5">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Banner de Estructura Exacta de Columnas + Botón Descargar Plantilla Base */}
          <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#FF6600]">
                Estructura Oficial de Columnas de la Plantilla Base
              </div>
              <div className="font-mono text-xs font-bold text-slate-900 leading-relaxed">
                {modeColumnsText}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadBaseEntityTemplate(activeMode, 'xlsx')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#FF6600]" />
                <span>Descargar Plantilla Base (.XLSX)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadBaseEntityTemplate(activeMode, 'csv')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Descargar Plantilla Base (.CSV)</span>
              </button>
            </div>
          </div>

          {/* Step 1: Subir Archivo o Cargar Datos de Ejemplo */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/60 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#FF6600] shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {fileName
                    ? `Archivo cargado: ${fileName} (${rawRows.length} filas)`
                    : 'Seleccione su archivo Excel (.xlsx, .xls) o CSV (.csv)'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Las columnas se vinculan automáticamente según los nombres de la plantilla base.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-extrabold transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir Archivo .XLSX / .CSV</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleData}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FF6600]" />
                <span>Cargar Planilla de Ejemplo</span>
              </button>
            </div>
          </div>

          {/* Opciones adicionales cuando se importan Productos */}
          {activeMode === 'products' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#FF6600] shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      Proveedor por Defecto (si la fila no especifica PROVEEDOR)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickSupplierOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Crear Proveedor Rápido</span>
                  </button>
                </div>

                <select
                  value={selectedSupplierName}
                  onChange={(e) => setSelectedSupplierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="">
                    -- Usar columna PROVEEDOR de la planilla --
                  </option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name} (CUIT: {sup.cuit})
                    </option>
                  ))}
                </select>

                {quickSupplierOpen && (
                  <form
                    onSubmit={handleQuickCreateSupplier}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Razón Social *"
                        value={quickSupplierForm.name}
                        onChange={(e) =>
                          setQuickSupplierForm({
                            ...quickSupplierForm,
                            name: e.target.value,
                          })
                        }
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="CUIT"
                        value={quickSupplierForm.cuit}
                        onChange={(e) =>
                          setQuickSupplierForm({
                            ...quickSupplierForm,
                            cuit: e.target.value,
                          })
                        }
                        className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
                      />
                      <button
                        type="submit"
                        disabled={isCreatingSupplier}
                        className="px-3 py-1.5 rounded-md bg-[#FF6600] text-white text-xs font-bold cursor-pointer"
                      >
                        {isCreatingSupplier ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#FF6600]" />
                    <span className="text-xs font-bold text-slate-900">
                      Cálculo Automático de Costo Unitario
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 font-bold">
                    Costo Unitario = PRECIO_COSTO_BULTO / UNIDADES_POR_BULTO
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-600 font-medium">¿Costo incluye IVA?</span>
                    <button
                      type="button"
                      onClick={() => setCostIncludesIva(true)}
                      className={`px-2 py-1 rounded text-xs font-bold cursor-pointer ${
                        costIncludesIva
                          ? 'bg-[#FF6600] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostIncludesIva(false)}
                      className={`px-2 py-1 rounded text-xs font-bold cursor-pointer ${
                        !costIncludesIva
                          ? 'bg-[#FF6600] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      No (+21%)
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-600 font-medium">Bonif. %:</span>
                    <div className="relative w-20">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        step="0.5"
                        value={commercialDiscount}
                        onChange={(e) => setCommercialDiscount(e.target.value)}
                        className="w-full pl-2 pr-6 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-md text-right"
                      />
                      <Percent className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Mapeo de Columnas y Vista Previa */}
          {rawHeaders.length > 0 && (
            <>
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  1. Vinculación de Columnas del Archivo
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>
                          {field.label}{' '}
                          {field.required && (
                            <span className="text-rose-600">*</span>
                          )}
                        </span>
                      </label>
                      <select
                        value={columnMap[field.key] || ''}
                        onChange={(e) =>
                          setColumnMap((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF6600]"
                      >
                        <option value="">-- Sin asignar --</option>
                        {rawHeaders.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vista Previa según Entidad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    2. Vista Previa de Registros ({validMappedItems.length} listos para importar)
                  </h4>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  {activeMode === 'products' ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                          <th className="py-2.5 px-3">CODIGO_SKU</th>
                          <th className="py-2.5 px-3">NOMBRE</th>
                          <th className="py-2.5 px-3">EMPAQUE / UNID.</th>
                          <th className="py-2.5 px-3 text-right">COSTO BULTO</th>
                          <th className="py-2.5 px-3 text-right">COSTO UNIT. (Auto)</th>
                          <th className="py-2.5 px-3 text-right">EFECTIVO UNID.</th>
                          <th className="py-2.5 px-3 text-right">TARJETA UNID.</th>
                          <th className="py-2.5 px-3 text-right">STOCK</th>
                          <th className="py-2.5 px-3">CATEGORIA / MARCA</th>
                          <th className="py-2.5 px-3">PROVEEDOR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {validMappedItems.slice(0, 15).map((item: any, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {item.sku}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                              {item.purchaseUnit} x {item.unitsPerPackage} u.
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {formatMoney(item.costPrice)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#FF6600] whitespace-nowrap">
                              {formatMoney(item.unitFractionalCost)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                              {formatMoney(item.salePrice)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-sky-700 whitespace-nowrap">
                              {formatMoney(item.cardPrice)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {item.stock}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {item.category} · {item.brand}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {item.supplierName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : activeMode === 'suppliers' ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                          <th className="py-2.5 px-3">RAZON SOCIAL</th>
                          <th className="py-2.5 px-3">CUIT</th>
                          <th className="py-2.5 px-3">TELEFONO</th>
                          <th className="py-2.5 px-3">EMAIL</th>
                          <th className="py-2.5 px-3">DIRECCION</th>
                          <th className="py-2.5 px-3">NOTAS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {validMappedItems.slice(0, 15).map((item: any, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {item.cuit}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {item.contactPhone}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {item.email}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {item.address || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {item.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                          <th className="py-2.5 px-3">NOMBRE</th>
                          <th className="py-2.5 px-3">TELEFONO</th>
                          <th className="py-2.5 px-3">CUIT</th>
                          <th className="py-2.5 px-3">DNI</th>
                          <th className="py-2.5 px-3 text-right">DEUDA TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {validMappedItems.slice(0, 15).map((item: any, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {item.phone}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {item.cuit}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {item.dni || '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                              {formatMoney(item.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {validMappedItems.length > 0
                ? `${validMappedItems.length} registros listos para guardar en la base de datos.`
                : 'Descargue la plantilla base o suba su archivo para comenzar.'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canConfirmImport}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold transition-colors cursor-pointer"
            >
              <span>
                {isSubmitting
                  ? 'Importando en Base de Datos...'
                  : `Confirmar e Importar (${validMappedItems.length})`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
