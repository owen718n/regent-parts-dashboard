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

function unique<T>(items: T[]) {
  return Array.from(new Set(items)).filter(Boolean) as T[];
}

function asText(v: unknown) {
  return v === null || v === undefined || v === '' ? '-' : String(v);
}

function App() {
  const [parts, setParts] = React.useState<Part[]>([]);
  const [bomItems, setBomItems] = React.useState<BomItem[]>([]);
  const [models, setModels] = React.useState<Model[]>([]);
  const [importInfo, setImportInfo] = React.useState<ImportInfo | null>(null);

  const [selectedModel, setSelectedModel] = React.useState('ALL');
  const [selectedSource, setSelectedSource] = React.useState('ALL');
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
        setError('Failed to load data from Firestore. Please check Firebase config, Firestore rules, and collection names.');
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
  const families = unique(models.map(m => m.family));

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
                <i style={{ width: `${Math.max(8, s.count / Math.max(parts.length, 1) * 100)}%` }} />
              </div>
              <b>{s.count}</b>
            </div>
          ))}
        </Card>

        <Card title="车型族">
          <div className="pillbox">
            {families.map(f => (
              <span className="pill" key={f}>
                {f}
              </span>
            ))}
          </div>
        </Card>
      </section>

      <section className="panel">
        <div className="toolbar">
          <label>
            Model
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
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
            <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)}>
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

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>SAP Code</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Source</th>
                <th>Location</th>
                <th>Group</th>
              </tr>
            </thead>

            <tbody>
              {filteredBom.slice(0, 500).map((item, i) => (
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
              ))}
            </tbody>
          </table>
        </div>

        <p className="note">
          Showing {Math.min(filteredBom.length, 500)} / {filteredBom.length}.
          如果数据继续变大，可以改成 Firestore 分页查询。
        </p>
      </section>

      <section className="panel">
        <h2>Top model by BOM record count</h2>
        <div className="model-list">
          {modelStats.slice(0, 12).map(m => (
            <button onClick={() => setSelectedModel(m.model)} key={m.model}>
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