import { useState, useEffect } from 'react';

// Cambia este valor cada vez que publiques un cambio
export const APP_VERSION = '1.0.1';

export function UpdateBanner() {
  const [needUpdate, setNeedUpdate] = useState(false);

  useEffect(() => {
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion && savedVersion !== APP_VERSION) {
      setNeedUpdate(true);
    } else {
      localStorage.setItem('app_version', APP_VERSION);
    }
  }, []);

  const handleUpdate = () => {
    localStorage.setItem('app_version', APP_VERSION);
    window.location.reload();
  };

  if (!needUpdate) return null;

  return (
    <div className="fixed bottom-5 left-5 right-5 bg-slate-800 text-white p-4 rounded-xl z-[9999] flex flex-col gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.3)] border border-slate-700">
      <strong className="text-sm font-bold">
        ¡Nueva versión disponible de Stock Rápido!
      </strong>
      <p className="m-0 text-sm text-slate-200">
        Hay una actualización lista con mejoras de rendimiento.
      </p>
      <button
        type="button"
        onClick={handleUpdate}
        className="bg-orange-500 hover:bg-orange-600 text-white border-none p-2.5 rounded-lg font-bold cursor-pointer transition-colors"
      >
        Actualizar ahora
      </button>
    </div>
  );
}
