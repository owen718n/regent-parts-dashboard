import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  Search,
  Database,
  Layers,
  PackageCheck,
  UploadCloud,
  Clock3,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import {
  getParts,
  getBomItems,
  getModels,
  getImports,
  updatePartManualFields,
  type PartManualFields,
} from './firestoreApi';
import './style.css';

type Part = {
  id: string;
  sapCode: string | null;
  description: string | null;
  group?: string | null;
  location?: string | null;
  source: string | null;
  standard?: string | null;
  time?: string | number | null;
  finishDate?: string | null;
  hidden?: boolean;
  originalRow: number;
};

type BomItem = {
  id?: string;
  partId: string;
  sapCode: string | null;
  model: string;
  qty: number | string;
  source: string | null;
  description: string | null;
  location?: string | null;
  group?: string | null;
  originalRow: number;
};

type Model = {
  id: string;
  modelCode: string;
  family: string;
  displayName: string;
};

type ImportInfo = {
  id?: string;
  fileName?: string;
  rowCount?: number;
  modelCount?: number;
  bomItemCount?: number;
  importedAt?: string;
};

type FamilyAverageBomItem = {
  key: string;
  partId: string;
  sapCode: string | null;
  description: string | null;
  source: string | null;
  location: string | null;
  group: string | null;
  standard: string;
  time: number | null;
  totalQty: number;
  averageQty: number;
  usedInModels: string;
};

type FamilyAverageBomDraft = {
  key: string;
  partId: string;
  sapCode: string | null;
  description: string | null;
  source: string | null;
  location: string | null;
  group: string | null;
  standard: string;
  time: number | null;
  totalQty: number;
  usedModelsSet: Set<string>;
};

const LOCATION_OPTIONS = [
  'Chassis',
  'Plumbing',
  'Electrical',
  'Internal',
  'Roof',
  'External',
];

const STANDARD_OPTIONS = ['Standard', 'Option'] as const;

function unique<T>(items: T[]) {
  return Array.from(new Set(items)).filter(Boolean) as T[];
}

function asText(v: unknown) {
  return v === null || v === undefined || v === '' ? '-' : String(v);
}

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(v: unknown) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getModelFamily(modelCode: string) {
  return String(modelCode || '').trim().slice(0, 3).toUpperCase();
}

function getPartTime(part?: Part | null) {
  return toNullableNumber(part?.time);
}

function getPartStandard(part?: Part | null) {
  const value = String(part?.standard || '').trim();
  return value === 'Option' ? 'Option' : 'Standard';
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  const hours = safe / 3600;

  if (hours >= 1) {
    return `${hours.toFixed(1)} h`;
  }

  const minutes = safe / 60;

  if (minutes >= 1) {
    return `${minutes.toFixed(1)} min`;
  }

  return `${safe.toFixed(0)} sec`;
}

function App() {
  const [parts, setParts] = React.useState<Part[]>([]);
  const [bomItems, setBomItems] = React.useState<BomItem[]>([]);
  const [models, setModels] = React.useState<Model[]>([]);
  const [importInfo, setImportInfo] = React.useState<ImportInfo | null>(null);

  const [selectedModel, setSelectedModel] = React.useState('ALL');
  const [selectedSource, setSelectedSource] = React.useState('ALL');
  const [selectedFamily, setSelectedFamily] = React.useState<string | null>(null);
  const [keyword, setKeyword] = React.useState('');
  const [showHidden, setShowHidden] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingParts, setSavingParts] = React.useState<Record<string, boolean>>(
    {}
  );

  const saveTimersRef = React.useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const pendingPatchesRef = React.useRef<Record<string, PartManualFields>>({});

  React.useEffect(() => {
    async function loadFirestoreData() {
      try {
        setLoading(true);
        setError(null);

        const [partsData, bomData, modelsData, importsData] = await Promise.all([
          getParts(),
          getBomItems(),
          getModels(),
          getImports(),
        ]);

        setParts(partsData as Part[]);
        setBomItems(bomData as BomItem[]);
        setModels(modelsData as Model[]);
        setImportInfo((importsData as ImportInfo[])[0] || null);
      } catch (err) {
        console.error('Firestore loading error:', err);
        setError(
          'Failed to load data from Firestore. Please check Firebase config, Firestore rules, and collection names.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadFirestoreData();

    return () => {
      Object.values(saveTimersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  function queuePartUpdate(partId: string, patch: PartManualFields) {
    if (!partId) return;

    setParts(prev =>
      prev.map(part => (part.id === partId ? { ...part, ...patch } : part))
    );

    pendingPatchesRef.current[partId] = {
      ...(pendingPatchesRef.current[partId] || {}),
      ...patch,
    };

    if (saveTimersRef.current[partId]) {
      clearTimeout(saveTimersRef.current[partId]);
    }

    saveTimersRef.current[partId] = setTimeout(async () => {
      const data = pendingPatchesRef.current[partId];

      delete pendingPatchesRef.current[partId];

      setSavingParts(prev => ({ ...prev, [partId]: true }));

      try {
        await updatePartManualFields(partId, data);
      } catch (err) {
        console.error('Save failed:', err);
        setError('Failed to save changes to Firestore. Please check Firestore rules.');
      } finally {
        setSavingParts(prev => ({ ...prev, [partId]: false }));
      }
    }, 650);
  }

  const partById = React.useMemo(() => {
    const map = new Map<string, Part>();

    parts.forEach(part => {
      map.set(part.id, part);
    });

    return map;
  }, [parts]);

  const partBySapCode = React.useMemo(() => {
    const map = new Map<string, Part>();

    parts.forEach(part => {
      if (part.sapCode) {
        map.set(String(part.sapCode), part);
      }
    });

    return map;
  }, [parts]);

  function getPartForBom(item: BomItem) {
    return (
      partById.get(item.partId) ||
      partBySapCode.get(String(item.sapCode || '')) ||
      null
    );
  }

  const visibleParts = React.useMemo(
    () => parts.filter(part => !part.hidden),
    [parts]
  );

  const hiddenParts = React.useMemo(
    () => parts.filter(part => part.hidden),
    [parts]
  );

  const visibleBomItems = React.useMemo(
    () =>
      bomItems.filter(item => {
        const part =
          partById.get(item.partId) ||
          partBySapCode.get(String(item.sapCode || '')) ||
          null;

        return !part?.hidden;
      }),
    [bomItems, partById, partBySapCode]
  );

  if (loading) {
    return (
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Firestore structure demo</p>
            <h1>Installation Transfer</h1>
            <p className="subtitle">Loading data from Firestore...</p>
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Firestore structure demo</p>
            <h1>Installation Transfer</h1>
            <p className="subtitle">{error}</p>
          </div>
        </section>
      </main>
    );
  }

  const sources = unique(visibleParts.map(p => p.source || 'Unknown')).sort();

  const families = unique(
    models.map(m => getModelFamily(m.modelCode)).filter(Boolean)
  ).sort();

  const selectedFamilyModels = selectedFamily
    ? models
        .map(m => m.modelCode)
        .filter(modelCode => getModelFamily(modelCode) === selectedFamily)
        .sort()
    : [];

  const filteredBom = visibleBomItems.filter(item => {
    const part = getPartForBom(item);

    const okModel = selectedModel === 'ALL' || item.model === selectedModel;

    const okSource =
      selectedSource === 'ALL' ||
      (part?.source || item.source || 'Unknown') === selectedSource;

    const k = keyword.trim().toLowerCase();

    const okKeyword =
      !k ||
      [
        item.sapCode,
        item.description,
        part?.location,
        part?.group,
        part?.standard,
        part?.finishDate,
        item.model,
      ].some(v => String(v || '').toLowerCase().includes(k));

    return okModel && okSource && okKeyword;
  });

  const familyAverageBom: FamilyAverageBomItem[] = selectedFamily
    ? Object.values(
        visibleBomItems
          .filter(item => selectedFamilyModels.includes(item.model))
          .filter(item => {
            const part = getPartForBom(item);

            const okSource =
              selectedSource === 'ALL' ||
              (part?.source || item.source || 'Unknown') === selectedSource;

            const k = keyword.trim().toLowerCase();

            const okKeyword =
              !k ||
              [
                item.sapCode,
                item.description,
                part?.location,
                part?.group,
                part?.standard,
                part?.finishDate,
                item.model,
              ].some(v => String(v || '').toLowerCase().includes(k));

            return okSource && okKeyword;
          })
          .reduce((acc, item) => {
            const part = getPartForBom(item);
            const key = String(
              item.sapCode || item.partId || item.description || ''
            ).trim();

            if (!key) return acc;

            const qty = toNumber(item.qty);

            if (!acc[key]) {
              acc[key] = {
                key,
                partId: part?.id || item.partId,
                sapCode: item.sapCode,
                description: item.description,
                source: part?.source || item.source,
                location: part?.location || null,
                group: part?.group || null,
                standard: getPartStandard(part),
                time: getPartTime(part),
                totalQty: 0,
                usedModelsSet: new Set<string>(),
              };
            }

            acc[key].totalQty += qty;
            acc[key].usedModelsSet.add(item.model);

            if (!acc[key].partId && part?.id) {
              acc[key].partId = part.id;
            }

            if (!acc[key].sapCode && item.sapCode) {
              acc[key].sapCode = item.sapCode;
            }

            if (!acc[key].description && item.description) {
              acc[key].description = item.description;
            }

            if (!acc[key].source && (part?.source || item.source)) {
              acc[key].source = part?.source || item.source;
            }

            if (!acc[key].location && part?.location) {
              acc[key].location = part.location;
            }

            if (!acc[key].group && part?.group) {
              acc[key].group = part.group;
            }

            const partTime = getPartTime(part);
            if (acc[key].time === null && partTime !== null) {
              acc[key].time = partTime;
            }

            acc[key].standard = getPartStandard(part);

            return acc;
          }, {} as Record<string, FamilyAverageBomDraft>)
      )
        .map(item => ({
          key: item.key,
          partId: item.partId,
          sapCode: item.sapCode,
          description: item.description,
          source: item.source,
          location: item.location,
          group: item.group,
          standard: item.standard,
          time: item.time,
          totalQty: item.totalQty,
          averageQty: Number(
            (item.totalQty / Math.max(selectedFamilyModels.length, 1)).toFixed(1)
          ),
          usedInModels: Array.from(item.usedModelsSet).sort().join(', '),
        }))
        .sort((a, b) =>
          String(a.sapCode || '').localeCompare(String(b.sapCode || ''))
        )
    : [];

  const sourceStats = sources.map(source => ({
    source,
    count: visibleParts.filter(p => (p.source || 'Unknown') === source).length,
  }));

  const modelStats = models
    .map(m => ({
      model: m.modelCode,
      count: visibleBomItems.filter(b => b.model === m.modelCode).length,
    }))
    .sort((a, b) => b.count - a.count);

  const modelTimeStats = models
    .map(model => {
      const totalSeconds = visibleBomItems
        .filter(item => item.model === model.modelCode)
        .reduce((sum, item) => {
          const part = getPartForBom(item);
          return sum + toNumber(item.qty) * toNumber(part?.time);
        }, 0);

      return {
        model: model.modelCode,
        totalSeconds,
      };
    })
    .filter(item => item.totalSeconds > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const familyTimeStats = families
    .map(family => {
      const familyModels = models
        .map(m => m.modelCode)
        .filter(modelCode => getModelFamily(modelCode) === family);

      const familyTotalSeconds = familyModels.reduce((sum, modelCode) => {
        const modelTotal = visibleBomItems
          .filter(item => item.model === modelCode)
          .reduce((modelSum, item) => {
            const part = getPartForBom(item);
            return modelSum + toNumber(item.qty) * toNumber(part?.time);
          }, 0);

        return sum + modelTotal;
      }, 0);

      return {
        family,
        totalSeconds: familyTotalSeconds,
        averageSeconds: familyTotalSeconds / Math.max(familyModels.length, 1),
      };
    })
    .filter(item => item.totalSeconds > 0)
    .sort((a, b) => b.averageSeconds - a.averageSeconds);

  const selectedFamilyModelTimeRows = selectedFamily
    ? modelTimeStats
        .filter(item => selectedFamilyModels.includes(item.model))
        .map(item => ({
          label: item.model,
          value: item.totalSeconds,
        }))
    : [];

  const modelTimeCardTitle = selectedFamily
    ? `${selectedFamily} family model total installation time`
    : 'Model total installation time';

  const showingCount = selectedFamily
    ? Math.min(familyAverageBom.length, 500)
    : Math.min(filteredBom.length, 500);

  const totalCount = selectedFamily ? familyAverageBom.length : filteredBom.length;

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Firestore structure demo</p>
          <h1>Installation Transfer</h1>
          <p className="subtitle">
            Automatically converted from Data5.xlsm: parts + bomItems + models + imports.
            This page reads from Firebase Firestore and supports in-site maintenance of Location,
            Group, Time, Standard, Finish Date, and Hidden fields.
          </p>
        </div>

        <div className="import-card">
          <UploadCloud size={22} />
          <strong>{importInfo?.fileName || 'Firestore Import'}</strong>
          <span>
            {importInfo?.rowCount ?? parts.length} parts /{' '}
            {importInfo?.modelCount ?? models.length} models /{' '}
            {importInfo?.bomItemCount ?? bomItems.length} BOM records
          </span>
        </div>
      </section>

      <section className="kpis">
        <Kpi icon={<PackageCheck />} label="Visible Parts" value={visibleParts.length} />
        <Kpi icon={<EyeOff />} label="Hidden Parts" value={hiddenParts.length} />
        <Kpi icon={<Layers />} label="Models" value={models.length} />
        <Kpi icon={<Database />} label="BOM Items" value={visibleBomItems.length} />
      </section>

      <section className="grid two">
        <Card title="Source Breakdown">
          {sourceStats.map(s => (
            <div className="bar-row" key={s.source}>
              <span>{s.source}</span>
              <div className="bar">
                <i
                  style={{
                    width: `${Math.max(
                      8,
                      (s.count / Math.max(visibleParts.length, 1)) * 100
                    )}%`,
                  }}
                />
              </div>
              <b>{s.count}</b>
            </div>
          ))}
        </Card>

        <Card title="Model Families">
          <div className="pillbox">
            {families.map(f => (
              <button
                type="button"
                className={`pill ${selectedFamily === f ? 'active' : ''}`}
                key={f}
                onClick={() => {
                  setSelectedFamily(selectedFamily === f ? null : f);
                  setSelectedModel('ALL');
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {selectedFamily && (
            <div className="family-summary">
              <strong>{selectedFamily}</strong>
              <span>
                Includes {selectedFamilyModels.length} specific models:
                {selectedFamilyModels.join(', ')}
              </span>
              <button
                type="button"
                className="clear-family"
                onClick={() => setSelectedFamily(null)}
              >
                Clear family filter
              </button>
            </div>
          )}
        </Card>
      </section>

      <section className="grid two">
        <Card title={modelTimeCardTitle}>
          <TimeChart
            rows={
              selectedFamily
                ? selectedFamilyModelTimeRows
                : modelTimeStats.slice(0, 12).map(item => ({
                    label: item.model,
                    value: item.totalSeconds,
                  }))
            }
          />
        </Card>

        <Card title="Family average installation time">
          <TimeChart
            rows={familyTimeStats.map(item => ({
              label: item.family,
              value: item.averageSeconds,
            }))}
          />
        </Card>
      </section>

      <section className="panel">
        <div className="toolbar">
          <label>
            Model
            <select
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                setSelectedFamily(null);
              }}
              disabled={!!selectedFamily}
            >
              <option value="ALL">All Models</option>
              {models.map(m => (
                <option key={m.modelCode} value={m.modelCode}>
                  {m.modelCode}
                </option>
              ))}
            </select>
          </label>

          <label>
            Source
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
            >
              <option value="ALL">All Sources</option>
              {sources.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="searchbox">
            Search
            <input
              placeholder="SAP Code / Description / Location / Group"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </label>
        </div>

        {selectedFamily && (
          <div className="mode-banner">
            Currently showing <strong>{selectedFamily}</strong> family average BOM mode.
            Qty = total usage of this part across all {selectedFamily} specific models ÷{' '}
            number of {selectedFamily} specific models, rounded to 1 decimal place.
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{selectedFamily ? 'Family' : 'Model'}</th>
                <th>SAP Code</th>
                <th>Description</th>
                <th className="col-qty">{selectedFamily ? 'Average Qty' : 'Qty'}</th>
                <th>Location</th>
                <th>Group</th>
                <th>Time Sec</th>
                <th>Standard</th>
                <th className="col-finish-date">Finish Date</th>
                <th>Source</th>
                {selectedFamily && <th>Used In Models</th>}
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {selectedFamily ? (
                familyAverageBom.slice(0, 500).map((item, i) => {
                  const part = partById.get(item.partId);
                  const partId = part?.id || item.partId;

                  return (
                    <tr key={`${item.key}-${i}`}>
                      <td>{selectedFamily}</td>
                      <td>{asText(item.sapCode)}</td>
                      <td>{asText(item.description)}</td>
                      <td className="col-qty">{item.averageQty.toFixed(1)}</td>
                      <EditableManualCells
                        part={part}
                        partId={partId}
                        saving={!!savingParts[partId]}
                        onChange={queuePartUpdate}
                      />
                      <td>
                        <span className="tag">{asText(item.source)}</span>
                      </td>
                      <td>{item.usedInModels}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-action danger"
                          onClick={() => queuePartUpdate(partId, { hidden: true })}
                          disabled={!partId}
                        >
                          <EyeOff size={15} />
                          Hide
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                filteredBom.slice(0, 500).map((item, i) => {
                  const part = getPartForBom(item);
                  const partId = part?.id || item.partId;

                  return (
                    <tr key={`${item.partId || item.sapCode}-${item.model}-${i}`}>
                      <td>{item.model}</td>
                      <td>{asText(item.sapCode)}</td>
                      <td>{asText(item.description)}</td>
                      <td className="col-qty">{asText(item.qty)}</td>
                      <EditableManualCells
                        part={part}
                        partId={partId}
                        saving={!!savingParts[partId]}
                        onChange={queuePartUpdate}
                      />
                      <td>
                        <span className="tag">
                          {asText(part?.source || item.source)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-action danger"
                          onClick={() => queuePartUpdate(partId, { hidden: true })}
                          disabled={!partId}
                        >
                          <EyeOff size={15} />
                          Hide
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="note">
          Showing {showingCount} / {totalCount}.
          {selectedFamily
            ? ' Currently showing family average BOM.'
            : ' Hidden parts will not be shown or counted in statistics.'}
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Hidden parts</h2>
          <button
            type="button"
            className="clear-family"
            onClick={() => setShowHidden(v => !v)}
          >
            {showHidden ? 'Hide hidden list' : 'Show hidden list'}
          </button>
        </div>

        {showHidden ? (
          hiddenParts.length ? (
            <div className="hidden-list">
              {hiddenParts.map(part => (
                <div className="hidden-item" key={part.id}>
                  <div>
                    <strong>{asText(part.sapCode)}</strong>
                    <span>{asText(part.description)}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => queuePartUpdate(part.id, { hidden: false })}
                  >
                    <RotateCcw size={15} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="note">No hidden parts.</p>
          )
        ) : (
          <p className="note">
            Hidden parts are excluded from tables, source stats, BOM counts and time charts.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Top model by BOM record count</h2>
        <div className="model-list">
          {modelStats.slice(0, 12).map(m => (
            <button
              type="button"
              onClick={() => {
                setSelectedModel(m.model);
                setSelectedFamily(null);
              }}
              key={m.model}
            >
              {m.model}
              <span>{m.count}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function EditableManualCells({
  part,
  partId,
  saving,
  onChange,
}: {
  part?: Part | null;
  partId: string;
  saving: boolean;
  onChange: (partId: string, patch: PartManualFields) => void;
}) {
  const location = part?.location || '';
  const group = part?.group || '';
  const time = part?.time ?? '';
  const isTimeEmpty = time === '';
  const standard = getPartStandard(part);
  const finishDate = part?.finishDate || '';

  return (
    <>
      <td>
        <select
          className="cell-select"
          value={location}
          onChange={e =>
            onChange(partId, {
              location: e.target.value || null,
            })
          }
          disabled={!partId}
        >
          <option value="">-</option>
          {LOCATION_OPTIONS.map(option => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      </td>

      <td>
        <input
          className="cell-input"
          value={group}
          placeholder="Group"
          onChange={e =>
            onChange(partId, {
              group: e.target.value || null,
            })
          }
          disabled={!partId}
        />
      </td>

      <td>
        <input
          className={`cell-input small ${isTimeEmpty ? 'cell-input-warning' : ''}`}
          value={time}
          type="number"
          min="0"
          step="1"
          placeholder="sec"
          onChange={e =>
            onChange(partId, {
              time: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          disabled={!partId}
        />
      </td>

      <td>
        <div className="standard-cell">
          <select
            className="cell-select"
            value={standard}
            onChange={e =>
              onChange(partId, {
                standard: e.target.value as 'Standard' | 'Option',
              })
            }
            disabled={!partId}
          >
            {STANDARD_OPTIONS.map(option => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
          {saving && <span className="saving-dot" title="Saving..." />}
        </div>
      </td>

      <td className="col-finish-date">
        <input
          className="cell-input finish-date-input"
          value={finishDate}
          type="month"
          onChange={e =>
            onChange(partId, {
              finishDate: e.target.value || null,
            })
          }
          disabled={!partId}
        />
      </td>
    </>
  );
}

function TimeChart({
  rows,
}: {
  rows: Array<{
    label: string;
    value: number;
  }>;
}) {
  const max = Math.max(...rows.map(row => row.value), 1);

  if (!rows.length) {
    return (
      <div className="empty-chart">
        <Clock3 size={22} />
        <span>No time data yet. Fill Time Sec to generate charts.</span>
      </div>
    );
  }

  return (
    <div className="time-chart">
      {rows.map(row => (
        <div className="time-row" key={row.label}>
          <span>{row.label}</span>
          <div className="time-bar">
            <i style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} />
          </div>
          <b>{formatSeconds(row.value)}</b>
        </div>
      ))}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="kpi">
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value.toLocaleString()}</strong>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
