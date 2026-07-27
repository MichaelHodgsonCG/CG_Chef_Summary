import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Download, ListOrdered, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type MenuLocation = { id: string; name: string; code: string };

type WeekOption = {
  weekEndingDate: string;
  fiscalYear: number;
  period: number;
  week: number;
  locationCount: number;
  label: string;
};

type VarianceRow = {
  location_id: string;
  item_name: string;
  net_variance_amount: number | null;
};

type AggItem = {
  itemName: string;
  total: number;
  byLocation: Map<string, number>;
};

const OVER_COUNT = 10;
const UNDER_COUNT = 5;

const money = (v: number) =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function ConsolidatedItemVariance() {
  const [menus, setMenus] = useState<string[]>([]);
  const [selectedMenu, setSelectedMenu] = useState('');
  const [locations, setLocations] = useState<MenuLocation[]>([]);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMenus();
  }, []);

  useEffect(() => {
    if (selectedMenu) loadMenuContext(selectedMenu);
  }, [selectedMenu]);

  useEffect(() => {
    if (locations.length > 0 && selectedWeeks.length > 0) loadData();
    else setRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, selectedWeeks]);

  const loadMenus = async () => {
    const { data } = await supabase
      .from('locations')
      .select('menu')
      .not('menu', 'is', null)
      .eq('exclude_from_reporting', false);
    const unique = Array.from(new Set((data || []).map((d) => d.menu as string))).sort();
    setMenus(unique);
    if (unique.length > 0) setSelectedMenu((prev) => prev || unique[0]);
  };

  const loadMenuContext = async (menu: string) => {
    const { data: locs } = await supabase
      .from('locations')
      .select('id, name, code')
      .eq('menu', menu)
      .eq('exclude_from_reporting', false)
      .order('name');
    setLocations(locs || []);

    const { data: wk } = await supabase.rpc('menu_variance_weeks', { p_menu: menu });
    const opts: WeekOption[] = (wk || []).map((w: any) => ({
      weekEndingDate: w.week_ending_date,
      fiscalYear: w.fiscal_year,
      period: w.period_number,
      week: w.week_number,
      locationCount: Number(w.location_count),
      label: `P${w.period_number} W${w.week_number} · WE ${w.week_ending_date}`,
    }));
    setWeeks(opts);
    setSelectedWeeks(opts.length > 0 ? [opts[0].weekEndingDate] : []);
    setExpanded(new Set());
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const ids = locations.map((l) => l.id);
      const { data } = await supabase
        .from('weekly_summary_item_variances')
        .select('location_id, item_name, net_variance_amount')
        .in('location_id', ids)
        .in('week_ending_date', selectedWeeks);
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  };

  const locName = useMemo(() => {
    const m = new Map<string, string>();
    locations.forEach((l) => m.set(l.id, l.name));
    return m;
  }, [locations]);

  // Aggregate net variance per item across the menu's locations for the selected
  // week(s); keep the per-location breakdown for the drill-down.
  const { over, under, reportingCount } = useMemo(() => {
    const byItem = new Map<string, AggItem>();
    const reporting = new Set<string>();
    for (const r of rows) {
      const v = r.net_variance_amount || 0;
      reporting.add(r.location_id);
      let agg = byItem.get(r.item_name);
      if (!agg) {
        agg = { itemName: r.item_name, total: 0, byLocation: new Map() };
        byItem.set(r.item_name, agg);
      }
      agg.total += v;
      agg.byLocation.set(r.location_id, (agg.byLocation.get(r.location_id) || 0) + v);
    }
    const all = Array.from(byItem.values());
    const over = all.filter((a) => a.total > 0).sort((a, b) => b.total - a.total).slice(0, OVER_COUNT);
    const under = all.filter((a) => a.total < 0).sort((a, b) => a.total - b.total).slice(0, UNDER_COUNT);
    return { over, under, reportingCount: reporting.size };
  }, [rows]);

  const toggleWeek = (wed: string) => {
    setSelectedWeeks((prev) =>
      prev.includes(wed) ? prev.filter((w) => w !== wed) : [...prev, wed]
    );
    setExpanded(new Set());
  };

  const toggleExpand = (item: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push(['Direction', 'Rank', 'Item', 'Consolidated Variance', 'Location', 'Location Variance'].join(','));
    const emit = (list: AggItem[], dir: string) => {
      list.forEach((a, i) => {
        const contribs = Array.from(a.byLocation.entries())
          .map(([id, v]) => ({ name: locName.get(id) || id, v }))
          .sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
        contribs.forEach((c) => {
          lines.push([dir, i + 1, `"${a.itemName}"`, a.total.toFixed(2), `"${c.name}"`, c.v.toFixed(2)].join(','));
        });
      });
    };
    emit(over, 'Over');
    emit(under, 'Under');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MenuVariance_${selectedMenu}_${selectedWeeks.slice().sort().join('_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSection = (title: string, subtitle: string, list: AggItem[], over: boolean) => (
    <div className="bg-cg-surface rounded-xl border border-cg-border shadow-cg overflow-hidden">
      <div className="px-5 py-3 border-b border-cg-border">
        <h3 className="text-base font-semibold text-cg-text">{title}</h3>
        <p className="text-xs text-cg-muted mt-0.5">{subtitle}</p>
      </div>
      {list.length === 0 ? (
        <p className="px-5 py-6 text-sm text-cg-muted text-center">No data for the selected week(s).</p>
      ) : (
        <div className="divide-y divide-cg-border">
          {list.map((a, i) => {
            const isOpen = expanded.has(a.itemName);
            const contribs = Array.from(a.byLocation.entries())
              .map(([id, v]) => ({ id, name: locName.get(id) || id, v }))
              .filter((c) => c.v !== 0)
              .sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
            const maxAbs = Math.max(...contribs.map((c) => Math.abs(c.v)), 1);
            return (
              <div key={a.itemName}>
                <button
                  onClick={() => toggleExpand(a.itemName)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-cg-surface2 transition-colors"
                >
                  <ChevronRight className={`w-4 h-4 text-cg-faint flex-none transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="w-6 text-sm font-semibold text-cg-faint tabular-nums flex-none">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-cg-text truncate">{a.itemName}</span>
                  <span className={`text-sm font-semibold tabular-nums ${over ? 'text-red-600' : 'text-green-700'}`}>
                    {a.total > 0 ? '+' : ''}{money(a.total)}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-3 pl-14 space-y-1.5">
                    {contribs.map((c) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="w-40 text-xs text-cg-muted truncate flex-none">{c.name}</span>
                        <div className="flex-1 h-2 bg-cg-surface3 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${c.v > 0 ? 'bg-red-400' : 'bg-green-400'}`}
                            style={{ width: `${(Math.abs(c.v) / maxAbs) * 100}%` }}
                          />
                        </div>
                        <span className={`w-20 text-right text-xs tabular-nums ${c.v > 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {c.v > 0 ? '+' : ''}{money(c.v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const fullCoverage = reportingCount >= locations.length && locations.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-cg-accent" />
            Menu Variance
          </h1>
          <p className="text-sm text-cg-muted mt-1">
            Consolidated over/under-used items across a menu's locations, with each location's contribution.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 border border-cg-border text-cg-text rounded-lg text-sm font-medium hover:bg-cg-surface2 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Controls */}
      <div className="bg-cg-surface rounded-xl border border-cg-border shadow-cg p-4 space-y-4">
        {menus.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-cg-muted uppercase tracking-wide mb-2">Menu</label>
            <div className="flex flex-wrap gap-2">
              {menus.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMenu(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    selectedMenu === m
                      ? 'bg-cg-accentSoft text-cg-accent border-cg-accent/30'
                      : 'bg-cg-surface text-cg-muted border-cg-border hover:bg-cg-surface2'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-cg-muted uppercase tracking-wide mb-2">
            Weeks <span className="normal-case font-normal">(select one or more)</span>
          </label>
          {weeks.length === 0 ? (
            <p className="text-sm text-cg-muted">No uploaded item variances yet for this menu.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {weeks.map((w) => {
                const on = selectedWeeks.includes(w.weekEndingDate);
                return (
                  <button
                    key={w.weekEndingDate}
                    onClick={() => toggleWeek(w.weekEndingDate)}
                    title={`${w.locationCount} of ${locations.length} locations reporting`}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      on
                        ? 'bg-cg-accentSoft text-cg-accent border-cg-accent/30'
                        : 'bg-cg-surface text-cg-muted border-cg-border hover:bg-cg-surface2'
                    }`}
                  >
                    P{w.period} W{w.week}
                    <span className="ml-1 text-xs opacity-70">({w.locationCount})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedWeeks.length > 0 && (
          <div className={`text-xs flex items-center gap-1.5 ${fullCoverage ? 'text-cg-muted' : 'text-amber-700'}`}>
            {!fullCoverage && <AlertTriangle className="w-3.5 h-3.5" />}
            {reportingCount} of {locations.length} locations have uploaded for the selected week{selectedWeeks.length > 1 ? 's' : ''}
            {!fullCoverage && ' — ranking will fill in as the rest upload.'}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-cg-surface rounded-xl border border-cg-border p-12 text-center text-sm text-cg-muted">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {renderSection(`Top ${OVER_COUNT} Over-Used`, 'Costing more than ideal — worst first. Click an item for the location breakdown.', over, true)}
          {renderSection(`Bottom ${UNDER_COUNT} Under-Used`, 'Under ideal — possible count errors or missed invoices.', under, false)}
        </div>
      )}
    </div>
  );
}
