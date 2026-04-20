/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  ReferenceArea
} from 'recharts';
import { Activity, ArrowRight, TrendingUp, BarChart3, AlertCircle, Download, FileDigit, LineChart as LineChartIcon, Layers } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type Status = 'idle' | 'loading' | 'success' | 'error';

interface Metrics {
  ai_return: number;
  benchmark_return: number;
  ma_benchmark_return: number;
  alpha: number;
  sharpe_ratio: number;
  max_drawdown: number;
}

interface ChartDataPoint {
  date: string;
  AI: number;
  Benchmark: number;
  Benchmark_MA: number;
}

interface BacktestResponse {
  status: string;
  metrics: Metrics;
  chart_data: ChartDataPoint[];
}

// ---------------------------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------------------------

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F1715] border border-[rgba(191,164,111,0.3)] p-3 rounded shadow-xl backdrop-blur-md">
        <p className="text-[#A8A39A] text-xs mb-3 font-medium uppercase tracking-widest">
          {new Date(label).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex flex-col gap-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8 text-sm">
              <span className="flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></span>
                <span className="text-[#E8E6E1] text-xs font-medium tracking-wide">
                  {entry.name === 'AI'
                    ? 'AI Strategy'
                    : entry.name === 'Benchmark_MA'
                      ? 'MA Benchmark'
                      : 'Benchmark'}
                </span>
              </span>
              <span className="font-semibold text-white font-mono text-xs">
                ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Date defaults: start 3 years ago, end today
  const today = new Date();
  const threeYearsAgo = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
  
  const [ticker, setTicker] = useState('AAPL');
  const [startDate, setStartDate] = useState(threeYearsAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [trainWindow, setTrainWindow] = useState(12); // months

  const [results, setResults] = useState<BacktestResponse | null>(null);
  
  const loadingStages = [
    {
      title: 'Secure Handshake',
      detail: 'Establishing secure connection...',
      icon: Activity,
    },
    {
      title: 'Data Ingestion',
      detail: 'Fetching historical market data...',
      icon: LineChartIcon,
    },
    {
      title: 'Model Calibration',
      detail: 'Training predictive models...',
      icon: Layers,
    },
    {
      title: 'Performance Audit',
      detail: 'Evaluating performance metrics...',
      icon: BarChart3,
    },
    {
      title: 'Terminal Sync',
      detail: 'Finalizing backtest...',
      icon: TrendingUp,
    },
  ] as const;

  // Loading sequence state
  const [loadingText, setLoadingText] = useState(loadingStages[0].detail);
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(4);

  // Zooming state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [zoomDomainLeft, setZoomDomainLeft] = useState<string | null>(null);
  const [zoomDomainRight, setZoomDomainRight] = useState<string | null>(null);

  // View preferences
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [showMABenchmark, setShowMABenchmark] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const premiumFeatures = [
    {
      title: 'Causal Alpha Engine',
      detail: 'Ensemble forecasting with confidence-aware allocation and rolling recalibration.',
      icon: TrendingUp,
    },
    {
      title: 'Institutional Visuals',
      detail: 'Interactive equity curves, zoom windows, brush navigation, and alpha overlays.',
      icon: LineChartIcon,
    },
    {
      title: 'Decision Ledger',
      detail: 'Date-indexed performance ledger with export-ready CSV snapshots for audit trails.',
      icon: FileDigit,
    },
    {
      title: 'Regime Context',
      detail: 'Benchmark and moving-average benchmark comparison to expose strategy edge quality.',
      icon: BarChart3,
    },
  ];

  const handleZoom = () => {
    if (refAreaLeft === refAreaRight || refAreaRight === null || refAreaLeft === null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    let left = refAreaLeft;
    let right = refAreaRight;
    if (new Date(left) > new Date(right)) {
      left = refAreaRight;
      right = refAreaLeft;
    }

    setZoomDomainLeft(left);
    setZoomDomainRight(right);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const handleZoomOut = () => {
    setZoomDomainLeft(null);
    setZoomDomainRight(null);
  };

  const exportToCSV = () => {
    if (!results) return;
    const headers = ['Date', 'AI Strategy', 'Benchmark', 'MA Benchmark', 'Alpha vs Benchmark'];
    const rows = results.chart_data.map(d => [
      d.date, 
      d.AI.toString(), 
      d.Benchmark.toString(),
      d.Benchmark_MA.toString(),
      (d.AI - d.Benchmark).toFixed(2)
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${ticker}_backtest_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    
    setStatus('loading');
    setErrorMessage('');
    setResults(null);
    setLoadingPhaseIndex(0);
    setLoadingText(loadingStages[0].detail);
    setLoadingProgress(8);
    
    // Cinematic staged loader that keeps momentum while waiting for API completion.
    let phase = 0;
    let progress = 8;
    
    const loadingInterval = setInterval(() => {
      phase = (phase + 1) % loadingStages.length;
      setLoadingPhaseIndex(phase);
      setLoadingText(loadingStages[phase].detail);
    }, 1200);

    const progressInterval = setInterval(() => {
      const increment = progress < 60 ? 3 : progress < 84 ? 2 : 1;
      progress = Math.min(progress + increment, 95);
      setLoadingProgress(progress);
    }, 220);

    const clearLoadingIntervals = () => {
      clearInterval(loadingInterval);
      clearInterval(progressInterval);
    };

    try {
      const response = await fetch('/api/run-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          start_date: startDate,
          end_date: endDate,
          train_window: trainWindow
        })
      });

      clearLoadingIntervals();
      setLoadingPhaseIndex(loadingStages.length - 1);
      setLoadingText(loadingStages[loadingStages.length - 1].detail);
      setLoadingProgress(100);
      
      if (!response.ok) {
        let detail = 'Analysis failed.';
        try {
          const errorPayload = await response.json();
          detail = errorPayload.detail || errorPayload.message || detail;
        } catch {
          // Keep fallback message when backend does not return JSON.
        }
        throw new Error(detail);
      }
      
      const data: BacktestResponse = await response.json();
      setResults(data);
      setStatus('success');
      
    } catch (err: any) {
      clearLoadingIntervals();
      setErrorMessage(err.message || 'Unable to fetch data for this ticker.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-base text-text-primary font-inter selection:bg-accent/30 relative overflow-x-clip">
      <motion.div
        aria-hidden="true"
        className="fixed -top-24 -left-24 w-96 h-96 rounded-full pointer-events-none blur-3xl opacity-25 -z-20"
        style={{ background: 'radial-gradient(circle, rgba(191,164,111,0.45) 0%, rgba(191,164,111,0) 65%)' }}
        animate={{ x: [0, 16, 0], y: [0, -12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: [0.23, 1, 0.32, 1] }}
      />
      <motion.div
        aria-hidden="true"
        className="fixed -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full pointer-events-none blur-3xl opacity-20 -z-20"
        style={{ background: 'radial-gradient(circle, rgba(122,157,143,0.5) 0%, rgba(122,157,143,0) 68%)' }}
        animate={{ x: [0, -22, 0], y: [0, 14, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: [0.23, 1, 0.32, 1] }}
      />
      <div aria-hidden="true" className="fixed inset-0 premium-grid pointer-events-none -z-10" />

      <header className="sticky top-0 z-40 border-b border-border-accent/40 bg-base/75 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border rounded-sm border-accent/40 flex items-center justify-center">
              <div className="w-2 h-2 bg-accent rounded-[1px]" />
            </div>
            <span className="tracking-widest text-xs font-semibold uppercase text-text-secondary">Equinox Terminal</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[11px] uppercase tracking-[0.2em] text-text-secondary">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
            <a href="#terminal-section" className="hover:text-white transition-colors">Live Terminal</a>
          </div>
          <a
            href="#terminal-section"
            className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black bg-accent px-4 py-2 rounded hover:bg-[#a68d5e] transition-colors"
          >
            Open Live
          </a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-20 md:pt-28 pb-20 md:pb-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-3 border border-border-accent/60 bg-base-light/60 px-4 py-2 rounded-full">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-text-secondary">Private Quant Infrastructure</span>
          </div>
          <h1 className="font-playfair text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.94] uppercase tracking-[0.06em]">
            Precision
            <br />
            <span className="text-text-secondary">Alpha</span>
            <br />
            Terminal
          </h1>
          <div className="flex items-center gap-4">
            <span className="h-[1px] w-12 bg-accent/40" />
            <p className="font-great-vibes text-4xl text-accent/85 tracking-wide">Curated</p>
          </div>
          <p className="text-sm md:text-base text-text-secondary max-w-2xl leading-relaxed">
            A premium backtesting workspace for serious strategy refinement. Run ensemble intelligence,
            compare benchmark drift, and inspect alpha quality with institutional visual clarity.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#terminal-section"
              className="group inline-flex items-center gap-2 bg-accent text-black uppercase tracking-widest text-xs font-semibold px-6 py-3 rounded transition-colors hover:bg-[#a68d5e]"
            >
              Launch Terminal
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 border border-border-accent px-6 py-3 rounded uppercase tracking-widest text-xs text-text-secondary hover:text-white hover:border-accent/50 transition-colors"
            >
              Explore Features
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            {[
              { label: 'Alpha Runs', value: '50K+' },
              { label: 'Latency', value: '< 2s' },
              { label: 'Coverage', value: '3Y+' },
              { label: 'Signal Modes', value: 'Adaptive' },
            ].map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 + idx * 0.08, ease: [0.23, 1, 0.32, 1] }}
                className="border border-border-accent/60 rounded px-4 py-3 bg-base-light/60"
              >
                <div className="text-lg font-semibold text-white leading-none">{item.value}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary mt-2">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.85, ease: [0.23, 1, 0.32, 1] }}
          className="relative"
        >
          <div className="rounded-2xl border border-border-accent bg-base-light/80 backdrop-blur-md p-6 md:p-7 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-border-accent/50 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Signal Snapshot</p>
                <p className="font-playfair text-2xl text-white mt-2">AAPL / Adaptive Model</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-text-secondary">Projected Alpha</p>
                <p className="text-3xl font-semibold text-accent mt-1">+1.00%</p>
              </div>
            </div>
            <div className="space-y-4 pt-5">
              {[
                { label: 'AI Return', val: 26.64, color: 'bg-accent' },
                { label: 'Benchmark', val: 25.64, color: 'bg-[#6A7873]' },
                { label: 'Sharpe', val: 0.57, color: 'bg-[#D9C69A]' },
              ].map((row, idx) => (
                <div key={row.label} className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
                    <span className="text-text-secondary">{row.label}</span>
                    <span className="text-white font-medium">{row.val}</span>
                  </div>
                  <div className="h-1.5 bg-base rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', row.color)}
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.max(25, Math.min(100, row.val * 3.2))}%` }}
                      transition={{ duration: 0.9, delay: 0.2 + idx * 0.1, ease: [0.23, 1, 0.32, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <motion.div
            aria-hidden="true"
            className="absolute -right-6 -bottom-6 w-36 h-36 border border-accent/30 rounded-full"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-6 md:px-8 pb-20 md:pb-24">
        <div className="flex items-end justify-between gap-6 border-b border-border-accent/50 pb-5 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary mb-3">Platform Composition</p>
            <h2 className="font-playfair text-3xl md:text-4xl uppercase tracking-[0.06em]">Designed For Quant Clarity</h2>
          </div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-accent hidden sm:block">Real-time motion and premium depth</span>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
          {premiumFeatures.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55, delay: idx * 0.08, ease: [0.23, 1, 0.32, 1] }}
              whileHover={{ y: -4 }}
              className="group border border-border-accent rounded-xl bg-base-light/70 backdrop-blur-sm p-5"
            >
              <feature.icon className="w-5 h-5 text-accent mb-4" />
              <h3 className="uppercase tracking-[0.14em] text-sm font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.detail}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="workflow" className="max-w-7xl mx-auto px-6 md:px-8 pb-20 md:pb-24">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 md:gap-10 items-start">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            className="border border-border-accent rounded-xl bg-base-light/60 p-6"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Workflow</p>
            <h3 className="font-playfair text-3xl uppercase tracking-[0.06em] mt-4">From Idea To Edge</h3>
            <p className="text-sm text-text-secondary leading-relaxed mt-4">
              Configure a symbol, define time context, run inference, and inspect alpha quality with
              transparent benchmark context.
            </p>
          </motion.div>
          <div className="space-y-3">
            {[
              { step: '01', title: 'Define Regime Context', detail: 'Select ticker, date boundaries, and training horizon.' },
              { step: '02', title: 'Run Ensemble Analysis', detail: 'Generate confidence-weighted strategy returns.' },
              { step: '03', title: 'Audit The Edge', detail: 'Inspect curves, alpha spread, and exportable ledger output.' },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.23, 1, 0.32, 1] }}
                className="border border-border-accent/70 rounded-xl bg-base-light/60 p-4 md:p-5 flex gap-4"
              >
                <div className="text-accent font-semibold tracking-[0.16em] text-sm mt-1">{item.step}</div>
                <div>
                  <p className="text-sm uppercase tracking-[0.14em] font-semibold text-white">{item.title}</p>
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed">{item.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="terminal-section" className="max-w-7xl mx-auto px-6 md:px-8 pb-28 md:pb-32">
        <div className="border border-border-accent/50 rounded-2xl bg-base-light/45 backdrop-blur-md p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-border-accent/40 pb-6 mb-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-text-secondary">Live Workspace</p>
              <h2 className="font-playfair text-3xl md:text-4xl uppercase tracking-[0.06em] mt-3">Backtesting Terminal</h2>
            </div>
            <p className="text-sm text-text-secondary max-w-md">
              Configure parameters and execute live strategy analysis with full benchmark comparison.
            </p>
          </div>

          <div className="w-full flex flex-col lg:flex-row gap-12 lg:gap-16">
            <div className="w-full lg:max-w-md xl:max-w-lg shrink-0 flex flex-col gap-6">
              <div className="bg-base-light border border-border-accent p-6 md:p-8 rounded-lg shadow-2xl shadow-black/50 relative overflow-hidden">
                <form onSubmit={handleRunBacktest} className="flex flex-col gap-6 relative z-10">
                  <div className="flex flex-col gap-2 relative">
                    <label className="text-xs uppercase tracking-widest font-medium text-text-secondary">Asset Ticker</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        className="w-full bg-base border border-border-accent rounded pt-3 pb-3 px-4 text-white font-medium text-lg focus:outline-none focus:border-accent/60 transition-colors placeholder:text-text-secondary/30 uppercase"
                        placeholder="E.G., AAPL"
                        disabled={status === 'loading'}
                      />
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-accent/40 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex flex-col gap-2 w-full">
                      <label className="text-xs uppercase tracking-widest font-medium text-text-secondary">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-base border border-border-accent rounded p-3 text-text-primary text-sm focus:outline-none focus:border-accent/60 transition-colors [color-scheme:dark]"
                        disabled={status === 'loading'}
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <label className="text-xs uppercase tracking-widest font-medium text-text-secondary">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-base border border-border-accent rounded p-3 text-text-primary text-sm focus:outline-none focus:border-accent/60 transition-colors [color-scheme:dark]"
                        disabled={status === 'loading'}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs uppercase tracking-widest font-medium text-text-secondary">Train Window</label>
                      <span className="text-accent text-sm font-semibold">{trainWindow} Months</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={trainWindow}
                      onChange={(e) => setTrainWindow(Number(e.target.value))}
                      className="w-full accent-accent bg-base h-1 cursor-pointer"
                      disabled={status === 'loading'}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className={cn(
                      "mt-4 w-full bg-accent text-black uppercase tracking-widest font-semibold text-sm py-4 px-6 rounded transition-all duration-200 flex items-center justify-center gap-2",
                      status === 'loading' ? "opacity-80 cursor-not-allowed bg-accent/70 text-black/50" : "hover:bg-[#a68d5e] hover:-translate-y-[1px] active:translate-y-0"
                    )}
                  >
                    {status === 'loading' ? (
                      <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4 animate-pulse" />
                        Analyzing...
                      </span>
                    ) : (
                      <>
                        Run Backtest
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-start relative min-h-[500px]">
          
          <AnimatePresence mode="wait">
            
            {status === 'idle' && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="w-full h-full flex flex-col items-center justify-center border border-border-accent/30 rounded-lg bg-base-light/30 backdrop-blur-sm self-start min-h-[500px] text-text-secondary/40"
              >
                {/* Abstract geometric background elements could go here, keeping it minimal */}
                <div className="w-32 h-32 border border-accent/10 rounded-full flex items-center justify-center mb-6">
                  <div className="w-16 h-16 border border-accent/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-accent/30 rounded-full"></div>
                  </div>
                </div>
                <p className="uppercase tracking-widest text-xs">Configure parameters to begin</p>
              </motion.div>
            )}

            {status === 'loading' && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                className="w-full h-full self-start min-h-[500px] border border-border-accent/40 rounded-xl bg-base-light/45 backdrop-blur-sm relative overflow-hidden"
              >
                <motion.div
                  aria-hidden="true"
                  className="absolute -top-28 -right-20 w-72 h-72 rounded-full blur-3xl opacity-30"
                  style={{ background: 'radial-gradient(circle, rgba(191,164,111,0.5) 0%, rgba(191,164,111,0) 70%)' }}
                  animate={{ x: [0, 10, 0], y: [0, -8, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: [0.23, 1, 0.32, 1] }}
                />
                <div className="relative z-10 p-6 md:p-8 lg:p-10 h-full flex flex-col">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 border-b border-border-accent/40">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-text-secondary">Live Processing</p>
                      <h3 className="font-playfair text-2xl md:text-3xl uppercase tracking-[0.06em] text-white mt-3">Compiling Strategy Intelligence</h3>
                    </div>
                    <motion.div
                      key={loadingProgress}
                      initial={{ opacity: 0.4, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-accent text-4xl md:text-5xl font-semibold leading-none"
                    >
                      {loadingProgress}%
                    </motion.div>
                  </div>

                  <div className="pt-6">
                    <div className="h-2 bg-base border border-border-accent/30 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-accent/70 via-accent to-[#D9C69A]"
                        animate={{ width: `${loadingProgress}%` }}
                        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                      />
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 mt-4">
                      {loadingStages.map((stage, idx) => {
                        const StageIcon = stage.icon;
                        const isComplete = idx < loadingPhaseIndex;
                        const isActive = idx === loadingPhaseIndex;
                        return (
                          <div
                            key={stage.title}
                            className={cn(
                              'rounded border px-2.5 py-2 flex items-start gap-2 transition-colors min-w-0',
                              isComplete && 'border-accent/50 bg-accent/10 text-accent',
                              isActive && 'border-accent/70 bg-accent/15 text-white',
                              !isComplete && !isActive && 'border-border-accent/40 bg-base/40 text-text-secondary'
                            )}
                          >
                            <StageIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="text-[10px] uppercase tracking-[0.1em] leading-tight min-w-0 break-words">{stage.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 grid lg:grid-cols-[0.95fr_1.05fr] gap-5 flex-1">
                    <div className="border border-border-accent/40 rounded-lg bg-base/35 p-4 md:p-5 flex flex-col items-center justify-center">
                      <div className="relative w-36 h-36 md:w-40 md:h-40 mb-5">
                        <motion.div
                          className="absolute inset-0 rounded-full border border-accent/30"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                        />
                        <motion.div
                          className="absolute inset-3 rounded-full border border-accent/20"
                          animate={{ rotate: -360 }}
                          transition={{ duration: 5.2, repeat: Infinity, ease: 'linear' }}
                        />
                        <motion.div
                          className="absolute inset-[28%] rounded-full border border-accent/45 flex items-center justify-center"
                          animate={{ scale: [1, 1.06, 1] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: [0.23, 1, 0.32, 1] }}
                        >
                          <Activity className="w-5 h-5 text-accent" />
                        </motion.div>
                      </div>
                      <motion.p
                        key={loadingText}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.25 }}
                        className="text-center text-sm uppercase tracking-[0.16em] text-accent/90"
                      >
                        {loadingText}
                      </motion.p>
                    </div>

                    <div className="border border-border-accent/40 rounded-lg bg-base/35 p-4 md:p-5 flex flex-col justify-center">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-text-secondary mb-4">Active Compute Threads</p>
                      {[
                        'Extracting multi-horizon return features',
                        'Ensemble weighting and confidence sizing',
                        'Stress-checking alpha against benchmark drift',
                      ].map((item, idx) => (
                        <div key={item} className="mb-4 last:mb-0">
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] mb-2">
                            <span className="text-text-secondary">{item}</span>
                            <span className="text-accent">{Math.min(99, loadingProgress + idx * 3)}%</span>
                          </div>
                          <div className="h-1.5 bg-base rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-accent/80 rounded-full"
                              animate={{ width: `${Math.min(100, loadingProgress + idx * 6)}%` }}
                              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div 
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full h-full flex flex-col items-center justify-center border border-[#7A2A2A]/20 bg-[#1A0A0A]/30 rounded-lg self-start min-h-[500px]"
              >
                <div className="flex flex-col items-center gap-4">
                  <AlertCircle className="w-8 h-8 text-[#BFA46F]/50" />
                  <p className="text-[#E8E6E1]/80 text-sm tracking-wide">{errorMessage}</p>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="mt-4 text-xs uppercase tracking-widest text-accent hover:text-white transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </motion.div>
            )}

            {status === 'success' && results && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full flex justify-start flex-col gap-10 opacity-100" // Ensure container allows natural flow
              >
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full">
                  {[
                    { label: "AI Return", value: results.metrics.ai_return, type: "percent", color: "accent" },
                    { label: "Benchmark", value: results.metrics.benchmark_return, type: "percent", color: "secondary" },
                    { label: "MA Benchmark", value: results.metrics.ma_benchmark_return, type: "percent", color: "secondary" },
                    { label: "Alpha", value: results.metrics.alpha, type: "percent", color: "white" },
                    { label: "Sharpe", value: results.metrics.sharpe_ratio, type: "number", color: "white" }
                  ].map((metric, i) => (
                    <motion.div 
                      key={metric.label}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
                      className="bg-base-light border border-border-accent p-5 rounded flex flex-col gap-2"
                    >
                      <span className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                        {metric.label}
                      </span>
                      <span className={cn(
                        "text-2xl font-semibold font-inter", 
                        metric.color === "accent" ? "text-accent" : 
                        metric.color === "white" ? "text-white" : "text-text-secondary"
                      )}>
                        {metric.value > 0 && metric.type === 'percent' ? '+' : ''}
                        {metric.value}{metric.type === 'percent' ? '%' : ''}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Insight Summary & View Controls */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="w-full flex flex-col md:flex-row md:items-center justify-between border-b mx-1 px-1 border-border-accent/40 pb-4 gap-4"
                >
                   <div className="flex items-center gap-3">
                     <TrendingUp className={cn("w-4 h-4", results.metrics.alpha > 0 ? "text-accent" : "text-text-secondary")} />
                     <p className="text-sm font-medium text-text-primary tracking-wide">
                        AI {results.metrics.alpha > 0 ? 'outperformed' : 'underperformed'} the benchmark by <span className={cn(results.metrics.alpha > 0 ? "text-accent" : "text-text-primary")}>{Math.abs(results.metrics.alpha)}%</span> over this period.
                     </p>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-2 md:gap-4 shrink-0">
                     <div className="flex bg-base-light border border-border-accent rounded p-1">
                       <button 
                         onClick={() => setViewMode('chart')}
                         className={cn("px-3 py-1 text-xs uppercase font-medium tracking-widest rounded flex items-center gap-1.5 transition-colors", viewMode === 'chart' ? "bg-base text-accent" : "text-text-secondary hover:text-white")}
                       >
                         <LineChartIcon className="w-3.5 h-3.5" />
                         Chart
                       </button>
                       <button 
                         onClick={() => setViewMode('table')}
                         className={cn("px-3 py-1 text-xs uppercase font-medium tracking-widest rounded flex items-center gap-1.5 transition-colors", viewMode === 'table' ? "bg-base text-accent" : "text-text-secondary hover:text-white")}
                       >
                         <FileDigit className="w-3.5 h-3.5" />
                         Ledger
                       </button>
                     </div>
                     <button
                       onClick={exportToCSV}
                       className="px-3 py-1.5 text-xs text-text-secondary bg-base-light hover:bg-base hover:text-accent border border-border-accent rounded flex items-center gap-1.5 uppercase tracking-widest font-medium transition-colors"
                     >
                       <Download className="w-3.5 h-3.5" />
                       Export CSV
                     </button>
                   </div>
                </motion.div>

                {/* Visualization Area */}
                <motion.div 
                  initial={{ opacity: 0, clipPath: 'inset(0% 100% 0% 0%)' }}
                  animate={{ opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
                  transition={{ duration: 1.2, delay: 0.4, ease: "easeInOut" }}
                  className="w-full bg-base-light border border-border-accent rounded-lg p-4 sm:p-6 relative min-h-[350px] sm:min-h-[450px] flex flex-col"
                >
                  
                  {viewMode === 'chart' ? (
                    <div className="flex-1 flex flex-col relative w-full h-full">
                      {/* Subtle Legend & Controls */}
                      <div className="absolute top-0 left-0 flex flex-col sm:flex-row sm:items-center gap-3 z-10 pointer-events-auto">
                         <div className="flex items-center gap-2">
                           <div className={cn("w-3 h-[2px]", chartType === 'area' ? "bg-accent/40" : "bg-accent")}></div>
                           <span className="text-xs uppercase tracking-widest text-white font-medium drop-shadow-sm">AI Strategy</span>
                         </div>
                         <button 
                           onClick={() => setShowBenchmark(!showBenchmark)}
                           className={cn("flex items-center gap-2 transition-opacity", !showBenchmark && "opacity-40 hover:opacity-80")}
                         >
                           <div className={cn("w-3 h-[2px]", chartType === 'area' ? "bg-[#6A7873]/40" : "bg-[#6A7873]")}></div>
                           <span className="text-xs uppercase tracking-widest text-text-secondary/90 hover:text-white transition-colors">Benchmark</span>
                         </button>
                         <button
                           onClick={() => setShowMABenchmark(!showMABenchmark)}
                           className={cn("flex items-center gap-2 transition-opacity", !showMABenchmark && "opacity-40 hover:opacity-80")}
                         >
                           <div className={cn("w-3 h-[2px]", chartType === 'area' ? "bg-[#D97706]/40" : "bg-[#D97706]")}></div>
                           <span className="text-xs uppercase tracking-widest text-text-secondary/90 hover:text-white transition-colors">MA Benchmark</span>
                         </button>
                      </div>

                      <div className="absolute top-0 right-0 z-10 flex gap-2 pointer-events-auto">
                        <button
                          onClick={() => setChartType(prev => prev === 'line' ? 'area' : 'line')}
                          className="bg-base/80 backdrop-blur-sm text-text-secondary border border-border-accent hover:border-accent/50 hover:text-white p-1.5 rounded transition-colors shadow-lg"
                          title={`Switch to ${chartType === 'line' ? 'Area' : 'Line'} Chart`}
                        >
                          <Layers className="w-4 h-4" />
                        </button>

                        <AnimatePresence>
                          {zoomDomainLeft && zoomDomainRight && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              onClick={handleZoomOut}
                              className="bg-base text-accent border border-border-accent hover:bg-accent hover:text-black uppercase tracking-widest text-[10px] font-semibold py-1.5 px-3 rounded transition-colors shadow-lg h-full hidden sm:block"
                            >
                              Zoom Out
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="w-full h-[300px] sm:h-[400px] mt-16 sm:mt-12">
                        <ResponsiveContainer width="100%" height="100%">
                          {chartType === 'area' ? (
                            <AreaChart 
                              data={results.chart_data} 
                              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                              onMouseDown={(e) => e && e.activeLabel && setRefAreaLeft(e.activeLabel)}
                              onMouseMove={(e) => refAreaLeft && e && e.activeLabel && setRefAreaRight(e.activeLabel)}
                              onMouseUp={handleZoom}
                              // Touch equivalents for mobile zoom/pan
                              onTouchStart={(e) => e && e.activeLabel && setRefAreaLeft(e.activeLabel)}
                              onTouchMove={(e) => refAreaLeft && e && e.activeLabel && setRefAreaRight(e.activeLabel)}
                              onTouchEnd={handleZoom}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(191,164,111,0.05)" />
                              <XAxis 
                                dataKey="date" 
                                domain={[zoomDomainLeft || 'dataMin', zoomDomainRight || 'dataMax']}
                                stroke="#A8A39A" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={40}
                                allowDataOverflow
                                tickFormatter={(val) => {
                                  const date = new Date(val);
                                  return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear().toString().slice(2)}`;
                                }}
                              />
                              <YAxis 
                                domain={['auto', 'auto']} 
                                stroke="#A8A39A" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                allowDataOverflow
                                width={50}
                                tickFormatter={(val) => {
                                  // Compact large numbers for mobile
                                  return val >= 1000 ? `$${(val/1000).toFixed(1)}k` : `$${val}`;
                                }}
                              />
                              <Tooltip 
                                content={<CustomTooltip />}
                                cursor={{ stroke: 'rgba(191, 164, 111, 0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                              />
                              <defs>
                                <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#BFA46F" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#BFA46F" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorBench" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6A7873" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#6A7873" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              {showBenchmark && (
                                <Area 
                                  type="monotone" 
                                  dataKey="Benchmark" 
                                  stroke="#6A7873" 
                                  strokeWidth={1.5} 
                                  fillOpacity={1} 
                                  fill="url(#colorBench)"
                                  activeDot={{ r: 4, fill: '#6A7873', stroke: 'none' }} 
                                  isAnimationActive={false}
                                />
                              )}
                              {showMABenchmark && (
                                <Area
                                  type="monotone"
                                  dataKey="Benchmark_MA"
                                  stroke="#D97706"
                                  strokeWidth={1.5}
                                  fillOpacity={0.6}
                                  fill="url(#colorBench)"
                                  activeDot={{ r: 4, fill: '#D97706', stroke: 'none' }}
                                  isAnimationActive={false}
                                />
                              )}
                              <Area 
                                type="monotone" 
                                dataKey="AI" 
                                stroke="#BFA46F" 
                                strokeWidth={2} 
                                fillOpacity={1} 
                                fill="url(#colorAI)"
                                activeDot={{ r: 5, fill: '#0A0D0C', stroke: '#BFA46F', strokeWidth: 2 }}
                                isAnimationActive={false}
                              />
                              {refAreaLeft && refAreaRight ? (
                                <ReferenceArea x1={refAreaLeft} x2={refAreaRight} />
                              ) : null}
                              <Brush 
                                dataKey="date" 
                                height={24} 
                                stroke="rgba(191,164,111,0.4)"
                                fill="#0A0D0C"
                                travellerWidth={12}
                                tickFormatter={(val) => {
                                  const date = new Date(val);
                                  return `${date.toLocaleString('default', { month: 'short' })} '${date.getFullYear().toString().slice(2)}`;
                                }}
                              />
                            </AreaChart>
                          ) : (
                            <LineChart 
                              data={results.chart_data} 
                              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                              onMouseDown={(e) => e && e.activeLabel && setRefAreaLeft(e.activeLabel)}
                              onMouseMove={(e) => refAreaLeft && e && e.activeLabel && setRefAreaRight(e.activeLabel)}
                              onMouseUp={handleZoom}
                              // Touch equivalents for mobile zoom/pan
                              onTouchStart={(e) => e && e.activeLabel && setRefAreaLeft(e.activeLabel)}
                              onTouchMove={(e) => refAreaLeft && e && e.activeLabel && setRefAreaRight(e.activeLabel)}
                              onTouchEnd={handleZoom}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(191,164,111,0.05)" />
                              <XAxis 
                                dataKey="date" 
                                domain={[zoomDomainLeft || 'dataMin', zoomDomainRight || 'dataMax']}
                                stroke="#A8A39A" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={40}
                                allowDataOverflow
                                tickFormatter={(val) => {
                                  const date = new Date(val);
                                  return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear().toString().slice(2)}`;
                                }}
                              />
                              <YAxis 
                                domain={['auto', 'auto']} 
                                stroke="#A8A39A" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false}
                                allowDataOverflow
                                width={50}
                                tickFormatter={(val) => {
                                  // Compact large numbers for mobile
                                  return val >= 1000 ? `$${(val/1000).toFixed(1)}k` : `$${val}`;
                                }}
                              />
                              <Tooltip 
                                content={<CustomTooltip />}
                                cursor={{ stroke: 'rgba(191, 164, 111, 0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                              />
                              {showBenchmark && (
                                <Line 
                                  type="monotone" 
                                  dataKey="Benchmark" 
                                  stroke="#6A7873" 
                                  strokeWidth={1.5} 
                                  dot={false}
                                  activeDot={{ r: 4, fill: '#6A7873', stroke: 'none' }} 
                                  isAnimationActive={false}
                                />
                              )}
                              {showMABenchmark && (
                                <Line
                                  type="monotone"
                                  dataKey="Benchmark_MA"
                                  stroke="#D97706"
                                  strokeWidth={1.5}
                                  dot={false}
                                  activeDot={{ r: 4, fill: '#D97706', stroke: 'none' }}
                                  isAnimationActive={false}
                                />
                              )}
                              <Line 
                                type="monotone" 
                                dataKey="AI" 
                                stroke="#BFA46F" 
                                strokeWidth={2} 
                                dot={false} 
                                activeDot={{ r: 5, fill: '#0A0D0C', stroke: '#BFA46F', strokeWidth: 2 }}
                                isAnimationActive={false}
                              />
                              {refAreaLeft && refAreaRight ? (
                                <ReferenceArea x1={refAreaLeft} x2={refAreaRight} />
                              ) : null}
                              <Brush 
                                dataKey="date" 
                                height={24} 
                                stroke="rgba(191,164,111,0.4)"
                                fill="#0A0D0C"
                                travellerWidth={12}
                                tickFormatter={(val) => {
                                  const date = new Date(val);
                                  return `${date.toLocaleString('default', { month: 'short' })} '${date.getFullYear().toString().slice(2)}`;
                                }}
                              />
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Mobile floating zoom reset if hidden from top corner */}
                      <AnimatePresence>
                        {zoomDomainLeft && zoomDomainRight && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={handleZoomOut}
                            className="bg-accent text-black uppercase tracking-widest text-[10px] font-bold py-2 px-4 rounded-full shadow-lg absolute bottom-[40px] right-2 sm:hidden z-20 pointer-events-auto"
                          >
                            Reset Zoom
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="w-full h-[400px] overflow-auto px-2 pb-4">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-base-light border-b border-border-accent shadow-[0_4px_10px_rgba(0,0,0,0.4)] z-10">
                          <tr>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-widest text-[#BFA46F]">Timestamp</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-widest text-white text-right">AI Equities</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-widest text-[#A8A39A] text-right">Benchmark</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-widest text-[#D97706] text-right">MA Benchmark</th>
                            <th className="py-3 px-4 text-xs font-semibold uppercase tracking-widest text-text-secondary text-right">Alpha (Δ)</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-mono text-text-primary divide-y divide-border-accent/30">
                          {[...(results?.chart_data || [])].reverse().map((data: ChartDataPoint, idx: number) => {
                             const alpha = data.AI - data.Benchmark;
                             return (
                              <tr key={idx} className="hover:bg-base/30 transition-colors">
                                <td className="py-3 px-4 text-text-secondary">
                                  {new Date(data.date).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="py-3 px-4 text-right text-white font-medium">
                                  ${data.AI.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 px-4 text-right text-text-secondary">
                                  ${data.Benchmark.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 px-4 text-right text-[#D97706]">
                                  ${data.Benchmark_MA.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className={cn("py-3 px-4 text-right font-medium", alpha >= 0 ? "text-accent" : "text-red-400/80")}>
                                  {alpha >= 0 ? '+' : ''}${alpha.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
                
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>

          </div>
        </div>
      </section>
    </div>
  );
}
