import { useState } from 'react';
import { reportsApi } from './api/reportsApi';
import { useAreas } from '@shared/hooks/useAreas';
import { TICKET_STATUS_LABELS, TicketStatusCode } from '@shared/types/ticket';
import { SelectField, TextField } from '@shared/components/FormField';
import { Button } from '@shared/components/Button';

const STATUS_OPTIONS: TicketStatusCode[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];

export function ReportsPage() {
  const { data: areas = [] } = useAreas();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<TicketStatusCode | ''>('');
  const [areaId, setAreaId] = useState('');
  const [isDownloading, setIsDownloading] = useState<'excel' | 'pdf' | null>(null);

  const filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: status || undefined,
    areaId: areaId ? Number(areaId) : undefined,
  };

  const handleDownload = async (kind: 'excel' | 'pdf') => {
    setIsDownloading(kind);
    try {
      if (kind === 'excel') await reportsApi.downloadTicketsExcel(filters);
      else await reportsApi.downloadSummaryPdf(filters);
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Reportes</h1>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: 13 }}>
          Seleccione un rango de fechas y filtros opcionales, luego descargue el reporte en el
          formato que necesite.
        </p>

        <div className="form-row">
          <TextField
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <TextField
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="form-row">
          <SelectField
            label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as TicketStatusCode | '')}
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABELS[s]}
              </option>
            ))}
          </SelectField>

          <SelectField label="Área" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Todas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Button loading={isDownloading === 'excel'} onClick={() => handleDownload('excel')}>
            Descargar Excel
          </Button>
          <Button
            variant="secondary"
            loading={isDownloading === 'pdf'}
            onClick={() => handleDownload('pdf')}
          >
            Descargar Resumen PDF
          </Button>
        </div>
      </div>
    </>
  );
}
