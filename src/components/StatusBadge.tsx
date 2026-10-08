import React from 'react';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  FileEdit,
  AlertCircle,
  Truck,
  Ban,
  PauseCircle,
  ClipboardList,
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
  title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onClick, title }) => {
  const normalized = (status || '').trim().toLowerCase();

  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
  let hexBg = '#f1f5f9';
  let hexText = '#334155';
  let hexBorder = '#e2e8f0';
  let IconComponent = FileEdit;

  if (
    normalized === 'aceptado' ||
    normalized === 'activa' ||
    normalized === 'activo' ||
    normalized === 'controla stock' ||
    normalized === 'saldado' ||
    normalized === 'recibido' ||
    normalized === 'acreditado' ||
    normalized === 'al día' ||
    normalized === 'al dia'
  ) {
    badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    hexBg = '#ecfdf5';
    hexText = '#047857';
    hexBorder = '#a7f3d0';
    IconComponent = CheckCircle2;
  } else if (
    normalized === 'pedido' ||
    normalized.startsWith('pedido') ||
    normalized.includes('en pedido')
  ) {
    badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-300';
    hexBg = '#eef2ff';
    hexText = '#4338ca';
    hexBorder = '#a5b4fc';
    IconComponent = Truck;
  } else if (
    normalized === 'borrador' ||
    normalized === 'sin publicar' ||
    normalized === 'inactivo' ||
    normalized === 'desactivado' ||
    normalized === 'sin control'
  ) {
    badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
    hexBg = '#f1f5f9';
    hexText = '#334155';
    hexBorder = '#cbd5e1';
    IconComponent = FileEdit;
  } else if (
    normalized === 'emitido' ||
    normalized === 'saldo a favor' ||
    normalized === 'en tránsito' ||
    normalized === 'en transito'
  ) {
    badgeStyle = 'bg-sky-50 text-sky-700 border-sky-200';
    hexBg = '#f0f9ff';
    hexText = '#0369a1';
    hexBorder = '#bae6fd';
    IconComponent = normalized.includes('tránsito') || normalized.includes('transito')
      ? Truck
      : FileCheck2;
  } else if (normalized === 'entregado') {
    badgeStyle = 'bg-teal-50 text-teal-700 border-teal-200';
    hexBg = '#f0fdfa';
    hexText = '#0f766e';
    hexBorder = '#99f6e4';
    IconComponent = Truck;
  } else if (
    normalized === 'pendiente' ||
    normalized === 'parcial' ||
    normalized === 'pago parcial' ||
    normalized === 'saldo pendiente' ||
    normalized === 'stock bajo' ||
    normalized === 'stock crítico' ||
    normalized === 'stock critico'
  ) {
    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-300';
    hexBg = '#fffbeb';
    hexText = '#92400e';
    hexBorder = '#fcd34d';
    IconComponent = Clock;
  } else if (normalized === 'pausada') {
    badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
    hexBg = '#fffbeb';
    hexText = '#92400e';
    hexBorder = '#fde68a';
    IconComponent = PauseCircle;
  } else if (
    normalized === 'anulado' ||
    normalized === 'cancelado' ||
    normalized === 'crítico' ||
    normalized === 'reponer stock' ||
    normalized.includes('sin stock') ||
    normalized.includes('negativo') ||
    normalized.includes('agotado') ||
    normalized.includes('vencido')
  ) {
    badgeStyle = 'bg-rose-50 text-rose-700 border-rose-300';
    hexBg = '#fff1f2';
    hexText = '#be123c';
    hexBorder = '#fda4af';
    IconComponent =
      normalized.includes('sin stock') ||
      normalized.includes('negativo') ||
      normalized.includes('agotado') ||
      normalized.includes('crítico') ||
      normalized.includes('reponer') ||
      normalized.includes('vencido')
        ? AlertCircle
        : Ban;
  }

  const content = (
    <>
      <IconComponent className="w-3.5 h-3.5 shrink-0" />
      <span className="whitespace-nowrap">{status}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || 'Haga clic para cambiar el estado'}
        data-badge-bg={hexBg}
        data-badge-text={hexText}
        data-badge-border={hexBorder}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-[#FF6600] ${badgeStyle}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      data-badge-bg={hexBg}
      data-badge-text={hexText}
      data-badge-border={hexBorder}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${badgeStyle}`}
    >
      {content}
    </span>
  );
};
