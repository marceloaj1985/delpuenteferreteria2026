import React, { useState, useMemo } from 'react';
import {
  Printer,
  ScanBarcode,
  X,
  Check,
  Tag,
  Copy,
} from 'lucide-react';
import { ProductItem } from '../types/ferreteria.ts';

interface BarcodePrintModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  formatCurrency: (val: string | number) => string;
}

/**
 * Generates deterministic high-contrast barcode bars (Code-128 style visual encoding)
 * from any alphanumeric SKU / Código string so it renders crisply in SVG and print.
 */
function generateBarcodePattern(code: string): number[] {
  const clean = (code || 'FER-0001').trim().toUpperCase();
  // Start pattern
  const bars: number[] = [2, 1, 1, 2, 3, 1];
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const b1 = (charCode % 3) + 1;
    const s1 = ((charCode >> 1) % 2) + 1;
    const b2 = ((charCode >> 2) % 3) + 1;
    const s2 = ((charCode >> 3) % 2) + 1;
    const b3 = ((charCode >> 4) % 2) + 1;
    const s3 = 1;
    bars.push(b1, s1, b2, s2, b3, s3);
  }
  // Stop pattern
  bars.push(2, 3, 1, 1, 2);
  return bars;
}

export const BarcodeSvg: React.FC<{ code: string; height?: number }> = ({
  code,
  height = 48,
}) => {
  const pattern = useMemo(() => generateBarcodePattern(code), [code]);
  const totalUnits = useMemo(
    () => pattern.reduce((acc, val) => acc + val, 0),
    [pattern]
  );

  let currentX = 0;
  return (
    <svg
      viewBox={`0 0 ${totalUnits} ${height}`}
      className="w-full h-12 max-w-[240px] mx-auto block"
      preserveAspectRatio="none"
      aria-label={`Código de barras ${code}`}
    >
      {pattern.map((widthUnit, idx) => {
        const isBar = idx % 2 === 0;
        const x = currentX;
        currentX += widthUnit;
        if (!isBar) return null;
        return (
          <rect
            key={idx}
            x={x}
            y={0}
            width={widthUnit}
            height={height}
            fill="#0F172A"
          />
        );
      })}
    </svg>
  );
};

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  product,
  isOpen,
  onClose,
  formatCurrency,
}) => {
  // Requerimiento 1 y 2: El Precio de Venta NO se incluye por defecto (desmarcado por defecto)
  const [includePrice, setIncludePrice] = useState<boolean>(false);
  const [copies, setCopies] = useState<number>(1);

  if (!isOpen || !product) return null;

  const safeCopies = Math.max(1, Math.min(48, copies || 1));

  const handlePrintLabels = () => {
    window.print();
  };

  return (
    <>
      {/* Estilos exclusivos para impresión térmica / hoja de etiquetas */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-barcode-sheet,
          #printable-barcode-sheet * {
            visibility: visible !important;
          }
          #printable-barcode-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            padding: 12px !important;
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)) !important;
            gap: 10px !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center shrink-0">
                <ScanBarcode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Impresión Rápida de Código de Barras y Etiquetas
                </h3>
                <p className="text-xs text-slate-500">
                  Configure las opciones de la etiqueta y previsualice en tiempo real antes de imprimir.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Opciones de Configuración Interactiva */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Switch / Checkbox: ¿Incluir Precio de Venta en la etiqueta? (desmarcado por defecto) */}
              <div className="flex flex-col justify-between p-3.5 rounded-lg bg-white border border-slate-200 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label
                      htmlFor="toggle-include-price"
                      className="text-xs font-bold text-slate-900 cursor-pointer flex items-center gap-1.5"
                    >
                      <Tag className="w-3.5 h-3.5 text-[#FF6600]" />
                      <span>¿Incluir Precio de Venta en la etiqueta?</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Campo opcional (desmarcado por defecto para etiquetas de góndola/depósito).
                    </p>
                  </div>

                  <button
                    id="toggle-include-price"
                    type="button"
                    role="switch"
                    aria-checked={includePrice}
                    onClick={() => setIncludePrice((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-[#FF6600] ${
                      includePrice ? 'bg-[#FF6600]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out ${
                        includePrice ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Estado en etiqueta:</span>
                  <span
                    className={`font-semibold ${
                      includePrice ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    {includePrice
                      ? `Mostrando precio (${formatCurrency(product.salePrice)})`
                      : 'Precio oculto (Solo Código y Descripción)'}
                  </span>
                </div>
              </div>

              {/* Selector de Cantidad de Copias / Etiquetas */}
              <div className="flex flex-col justify-between p-3.5 rounded-lg bg-white border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span>Cantidad de copias / etiquetas</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={48}
                    value={copies}
                    onChange={(e) =>
                      setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="w-20 px-2.5 py-1 text-xs font-mono font-bold text-right border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 4, 6, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCopies(num)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
                        copies === num
                          ? 'bg-[#FF6600] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      x{num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumen de Campos de la Etiqueta */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 px-1">
              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Obligatorios: Gráfica de Barras, Código ({product.sku}) y Descripción
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500">
                Opcional: Precio de Venta ({includePrice ? 'Incluido' : 'No incluido'})
              </span>
            </div>

            {/* Vista Previa de Impresión en Tiempo Real */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  Vista Previa de Etiqueta en Tiempo Real ({safeCopies}{' '}
                  {safeCopies === 1 ? 'copia' : 'copias'})
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  Formato Estándar 55mm × 35mm
                </span>
              </div>

              <div className="p-5 rounded-xl bg-slate-100 border border-slate-200 max-h-80 overflow-y-auto">
                <div
                  id="printable-barcode-sheet"
                  className={`grid gap-3 ${
                    safeCopies === 1
                      ? 'grid-cols-1 max-w-xs mx-auto'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {Array.from({ length: safeCopies }).map((_, idx) => (
                    <div
                      key={idx}
                      className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-3.5 flex flex-col items-center text-center shadow-2xs space-y-1.5"
                    >
                      {/* Cabecera comercio discreta */}
                      <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                        FERRETERIA DEL PUENTE
                      </span>

                      {/* Campo Obligatorio 1: Descripción / Nombre del Producto */}
                      <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight w-full px-1">
                        {product.name.replace(/\s*\[Costo Neto[^\]]*\]/gi, '').trim()}
                      </p>

                      {/* Campo Obligatorio 2: Código de Barras (Gráfica de Barras) */}
                      <div className="w-full py-1 px-2 bg-white">
                        <BarcodeSvg
                          code={product.barcode || product.sku}
                          height={44}
                        />
                      </div>

                      {/* Campo Obligatorio 3: Código de Barras / Código de Proveedor impreso en texto */}
                      <span className="text-xs font-mono font-bold tracking-wider text-slate-900">
                        {product.barcode || product.sku}
                      </span>

                      {/* Campo Opcional: Precio de Venta (solo si el usuario activa el switch) */}
                      {includePrice && (
                        <div className="w-full pt-1.5 mt-1 border-t border-slate-200 flex items-center justify-center">
                          <span className="text-base font-mono font-bold tabular-nums text-slate-950">
                            {formatCurrency(product.salePrice)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-slate-500">
              Lista para impresora térmica de etiquetas o plancha A4.
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handlePrintLabels}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6600]"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>
                  Imprimir {safeCopies} {safeCopies === 1 ? 'Etiqueta' : 'Etiquetas'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
