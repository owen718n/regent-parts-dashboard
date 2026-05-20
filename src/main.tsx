import React from 'react';
import ReactDOM from 'react-dom/client';
import { Search, Database, Layers, PackageCheck, UploadCloud } from 'lucide-react';
import { getParts, getBomItems, getModels, getImports } from './firestoreApi';
import './style.css';

type Part = {
  id: string;
  sapCode: string | null;
  description: string | null;
  group: string | null;
  location: string | null;
  source: string | null;
  standard: string | null;
  time: string | number | null;
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
  location: string | null;
  group: string | null;
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
  sapCode: string | null;
  description: string | null;
  source: string | null;
  location: string | null;
  group: string | null;
  totalQty: number;
  averageQty: number;
  usedInModels: string;
};

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

function getModelFamily(modelCode: string) {
  return String(modelCode || '').trim().slice(0, 3).toUpperCase();
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

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
  }, []);

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

  const sources = unique(parts.map(p => p.source || 'Unknown'));

  /**
   * 车型族不再依赖 models.family 字段。
   * 直接从 modelCode 前 3 位提取：
   * SRC14 / SRC16 / SRC19 -> SRC
   * SRH16 / SRH19 -> SRH
   */
  const families = unique(
    models
      .map(m => getModelFamily(m.modelCode))
      .filter(Boolean)
  ).sort();

  const selectedFamilyModels = selectedFamily
    ? models
        .map(m => m.modelCode)
        .filter(modelCode => getModelFamily(modelCode) === selectedFamily)
        .sort()
    : [];

  const filteredBom = bomItems.filter(item => {
    const okModel = selectedModel === 'ALL' || item.model === selectedModel;
    const okSource = selectedSource === 'ALL' || (item.source || 'Unknown') === selectedSource;

    const k = keyword.trim().toLowerCase();
    const okKeyword =
      !k ||
      [item.sapCode, item.description, item.location, item.group, item.model]
        .some(v => String(v || '').toLowerCase().includes(k));

    return okModel && okSource && okKeyword;
  });

  /**
   * 点击车型族后的平均 BOM。
   *
   * 例：
   * 点击 SRC
   * -> 找 SRC 开头的所有车型：SRC14 / SRC16 / SRC17 / SRC19...
   * -> 找这些车型用到的所有 BOM item
   * -> 按同一个零件合并
   * -> averageQty = totalQty / SRC 车型数量
   *
   * 没有用到该零件的车型，按 0 参与平均。
   */
  const familyAverageBom: FamilyAverageBomItem[] = selectedFamily
    ? Object.values(
        bomItems
          .filter(item => selectedFamilyModels.includes(item.model))
          .filter(item => {
            const okSource =
              selectedSource === 'ALL' ||
              (item.source || 'Unknown') === selectedSource;

            const k = keyword.trim().toLowerCase();
            const okKeyword =
              !k ||
              [item.sapCode, item.description, item.location, item.group, item.model]
                .some(v => String(v || '').toLowerCase().includes(k));

            return okSource && okKeyword;
          })
          .reduce((acc, item) => {
            /**
             * 优先用 sapCode 合并。
             * 如果 sapCode 为空，再用 partId。
             * 如果两者都没有，再用 description。
             */
            const key = String(item.sapCode || item.partId || item.description || '').trim();

            if (!key) return acc;

            const qty = toNumber(item.qty);

            if (!acc[key]) {
              acc[key] = {
                key,
                sapCode: item.sapCode,
                description: item.description,
                source: item.source,
                location: item.location,
                group: item.group,
                totalQty: 0,
                usedModelsSet: new Set<string>(),
              };
            }

            acc[key].totalQty += qty;
            acc[key].usedModelsSet.add(item.model);

            /**
             * 如果某些字段第一条为空，后面有值，则补上。
             */
            if (!acc[key].sapCode && item.sapCode) acc[key].sapCode = item.sapCode;
            if (!acc[key].description && item.description) acc[key].description = item.description;
            if (!acc[key].source && item.source) acc[key].source = item.source;
            if (!acc[key].location && item.location) acc[key].location = item.location;
            if (!acc[key].group && item.group) acc[key].group = item.group;

            return acc;
          }, {} as Record<string, {
            key: string;
            sapCode: string | null;
            description: string | null;
            source: string | null;
            location: string | null;
            group: string | null;
            totalQty: number;
            usedModelsSet: Set<string>;
          }>)
      )
        .map(item => ({
          key: item.key,
          sapCode: item.sapCode,
          description: item.description,
          source: item.source,
          location: item.location,
          group: item.group,
          totalQty: item.totalQty,
          averageQty: Number(
            (item.totalQty / Math.max(selectedFamilyModels.length, 1)).toFixed(1)
          ),
          usedInModels: Array.from(item.usedModelsSet).sort().join(', '),
        }))
        .sort((a, b) => {
          const codeA = String(a.sapCode || '');
          const codeB = String(b.sapCode || '');
          return codeA.localeCompare(codeB);
        })
    : [];

  const sourceStats = sources.map(source => ({
    source,
    count: parts.filter(p => (p.source || 'Unknown') === source).length,
  }));

  const modelStats = models
    .map(m => ({
      model: m.modelCode,
      count: bomItems.filter(b => b.model === m.modelCode).length,
    }))
    .sort((a, b) => b.count - a.count);

  const showingCount = selectedFamily
    ? Math.min(familyAverageBom.length, 500)
    : Math.min(filteredBom.length, 500);

  const totalCount = selectedFamily
    ? familyAverageBom.length
    : filteredBom.length;

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Firestore structure demo</p>
          <h1>Installation Transfer</h1>
          <p className="subtitle">
            基于 Data5.xlsm 自动转换：parts + bomItems + models + imports。
            当前页面已经改为从 Firebase Firestore 读取数据。
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
        <Kpi icon={<PackageCheck />} label="Parts" value={parts.length} />
        <Kpi icon={<Layers />} label="Models" value={models.length} />
        <Kpi icon={<Database />} label="BOM Items" value={bomItems.length} />
        <Kpi icon={<Search />} label="Sources" value={sources.length} />
      </section>

      <section className="grid two">
        <Card title="Source 结构">
          {sourceStats.map(s => (
            <div className="bar-row" key={s.source}>
              <span>{s.source}</span>
              <div className="bar">
                <i
                  style={{
                    width: `${Math.max(
                      8,
                      (s.count / Math.max(parts.length, 1)) * 100
                    )}%`,
                  }}
                />
              </div>
              <b>{s.count}</b>
            </div>
          ))}
        </Card>

        <Card title="车型族">
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
                包含 {selectedFamilyModels.length} 个具体车型：
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
              placeholder="SAP Code / Description / Location"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </label>
        </div>

        {selectedFamily && (
          <div className="mode-banner">
            当前为 <strong>{selectedFamily}</strong> 车型族平均 BOM 模式。
            Qty = 该零件在 {selectedFamily} 所有具体车型中的总用量 ÷{' '}
            {selectedFamily} 具体车型数量，结果保留 1 位小数。
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{selectedFamily ? 'Family' : 'Model'}</th>
                <th>SAP Code</th>
                <th>Description</th>
                <th>{selectedFamily ? 'Average Qty' : 'Qty'}</th>
                <th>Source</th>
                <th>Location</th>
                <th>Group</th>
                {selectedFamily && <th>Used In Models</th>}
              </tr>
            </thead>

            <tbody>
              {selectedFamily ? (
                familyAverageBom.slice(0, 500).map((item, i) => (
                  <tr key={`${item.key}-${i}`}>
                    <td>{selectedFamily}</td>
                    <td>{asText(item.sapCode)}</td>
                    <td>{asText(item.description)}</td>
                    <td>{item.averageQty.toFixed(1)}</td>
                    <td>
                      <span className="tag">{asText(item.source)}</span>
                    </td>
                    <td>{asText(item.location)}</td>
                    <td>{asText(item.group)}</td>
                    <td>{item.usedInModels}</td>
                  </tr>
                ))
              ) : (
                filteredBom.slice(0, 500).map((item, i) => (
                  <tr key={`${item.partId || item.sapCode}-${item.model}-${i}`}>
                    <td>{item.model}</td>
                    <td>{asText(item.sapCode)}</td>
                    <td>{asText(item.description)}</td>
                    <td>{asText(item.qty)}</td>
                    <td>
                      <span className="tag">{asText(item.source)}</span>
                    </td>
                    <td>{asText(item.location)}</td>
                    <td>{asText(item.group)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="note">
          Showing {showingCount} / {totalCount}.
          {selectedFamily
            ? ' 当前显示的是车型族平均 BOM。'
            : ' 如果数据继续变大，可以改成 Firestore 分页查询。'}
        </p>
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