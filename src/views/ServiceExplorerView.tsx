import React, { useState, useMemo, useRef } from 'react';
import { AWS_SERVICES, SERVICE_COMPARISONS } from '../core/serviceDatabase';
import type { AWSServiceGuide, ServiceComparison } from '../core/types';
import { 
  Server, 
  Layers, 
  Search, 
  ExternalLink, 
  AlertTriangle, 
  Sparkles, 
  BookOpen, 
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Table,
  BadgeCheck
} from 'lucide-react';
import { useLanguage } from '../context/useLanguage';
import { segmentTextByMatches } from '../core/textHighlighter';

interface ServiceExplorerViewProps {
  onBackToHome: () => void;
  onSelectServiceToStudy?: (serviceTag: string) => void;
  initialServiceId?: string;
}

// Highlight keywords for quick visual discrimination in architectural comparisons
const HIGHLIGHT_TERMS: { pattern: RegExp; colorClass: string }[] = [
  // Resilience / Sync states
  { pattern: /\b(STATEFUL)\b/gi, colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold' },
  { pattern: /\b(STATELESS)\b/gi, colorClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-bold' },
  { pattern: /\b(SYNCHRONOUS)\b/gi, colorClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-bold' },
  { pattern: /\b(ASYNCHRONOUS)\b/gi, colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold' },
  { pattern: /\b(Active-Active)\b/gi, colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold' },
  { pattern: /\b(Active-Passive|Single-Primary)\b/gi, colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-bold' },

  // Network & Scope
  { pattern: /\b(Layer 7|Layer 4|Layer 3)\b/gi, colorClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-bold' },
  { pattern: /\b(Multi-AZ|Regional|Cross-Region)\b/gi, colorClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border-teal-300 dark:border-teal-700 font-semibold' },
  { pattern: /\b(Single AZ|SINGLE Availability Zone|Single point of failure)\b/gi, colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-semibold' },
  { pattern: /\b(Static IP|Elastic IP|Dynamic IP)\b/gi, colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold' },

  // Encryption & Security
  { pattern: /\b(ENCRYPTED by default)\b/gi, colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold' },
  { pattern: /\b(UNENCRYPTED by default)\b/gi, colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold' },
  { pattern: /\b(ALLOW only|ALLOW and DENY)\b/gi, colorClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-bold' },

  // Decisive Exam Keywords
  { pattern: /\b(FREE|Free of charge)\b/gi, colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold' },
  { pattern: /\b(MANDATORY|CANNOT|NO|NOT REPLAYABLE)\b/g, colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold' },
  { pattern: /\b(REPLAYABLE|YES|NATIVE AUTOMATIC ROTATION)\b/g, colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold' },
  { pattern: /\b(POSIX-compliant|POSIX|NFSv4|SMB|Block storage|Object storage)\b/gi, colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-medium' },
  { pattern: /\b(Sub-second|Microsecond|Milliseconds)\b/gi, colorClass: 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border-violet-300 dark:border-violet-700 font-medium' },
];

export const KeywordHighlighter: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const rules = HIGHLIGHT_TERMS.map((term) => ({
    pattern: term.pattern,
    data: term,
  }));

  const segments = segmentTextByMatches(text, rules);

  return (
    <span>
      {segments.map((segment, index) => {
        if (segment.type === 'highlight') {
          return (
            <mark
              key={index}
              className={`inline-block mx-0.5 px-1.5 py-0.2 rounded border text-[11px] leading-tight ${segment.data.colorClass}`}
            >
              {segment.text}
            </mark>
          );
        }

        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
};

export const ServiceExplorerView: React.FC<ServiceExplorerViewProps> = ({
  onBackToHome,
  onSelectServiceToStudy,
  initialServiceId,
}) => {
  const { t } = useLanguage();
  // Defensive check: initialServiceId may be passed or undefined, ensure safe string
  const cleanInitialId = typeof initialServiceId === 'string' ? initialServiceId : undefined;
  const isInitialComparison = cleanInitialId ? cleanInitialId.includes('-vs-') : false;

  const [activeTab, setActiveTab] = useState<'services' | 'comparisons'>(
    isInitialComparison ? 'comparisons' : 'services'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCompCategory, setSelectedCompCategory] = useState<string>('All');

  const [selectedService, setSelectedService] = useState<AWSServiceGuide | null>(() => {
    if (cleanInitialId && !cleanInitialId.includes('-vs-')) {
      return (
        AWS_SERVICES.find(
          (s) =>
            s.id.toLowerCase() === cleanInitialId.toLowerCase() ||
            s.abbreviation?.toLowerCase() === cleanInitialId.toLowerCase()
        ) || AWS_SERVICES[0]
      );
    }
    return AWS_SERVICES[0] || null;
  });

  const [selectedComparison, setSelectedComparison] = useState<ServiceComparison | null>(() => {
    if (cleanInitialId && cleanInitialId.includes('-vs-')) {
      return SERVICE_COMPARISONS.find((c) => c.id === cleanInitialId) || SERVICE_COMPARISONS[0];
    }
    return SERVICE_COMPARISONS[0] || null;
  });

  const detailRef = useRef<HTMLDivElement | null>(null);
  const compDetailRef = useRef<HTMLDivElement | null>(null);

  const handleSelectService = (service: AWSServiceGuide) => {
    setSelectedService(service);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const handleSelectComparison = (comp: ServiceComparison) => {
    setSelectedComparison(comp);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => {
        compDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const serviceCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of AWS_SERVICES) {
      set.add(s.category);
    }
    return ['All', ...Array.from(set)];
  }, []);

  const compCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of SERVICE_COMPARISONS) {
      set.add(c.category);
    }
    return ['All', ...Array.from(set)];
  }, []);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return AWS_SERVICES.filter((s) => {
      const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.abbreviation && s.abbreviation.toLowerCase().includes(q)) ||
        s.summary.toLowerCase().includes(q) ||
        s.coreConcepts.some((c) => c.toLowerCase().includes(q)) ||
        s.examRelevance.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCategory]);

  const filteredComparisons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SERVICE_COMPARISONS.filter((c) => {
      const matchCat = selectedCompCategory === 'All' || c.category === selectedCompCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.services.some((srv) => srv.toLowerCase().includes(q)) ||
        c.examTip.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedCompCategory]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.nav.dashboard}</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t.architecture.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.architecture.subtitle}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setActiveTab('services');
              if (!selectedService && AWS_SERVICES.length > 0) {
                setSelectedService(AWS_SERVICES[0]);
              }
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'services'
                ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>{t.architecture.tabServices} ({AWS_SERVICES.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('comparisons');
              if (!selectedComparison && SERVICE_COMPARISONS.length > 0) {
                setSelectedComparison(SERVICE_COMPARISONS[0]);
              }
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'comparisons'
                ? 'bg-white text-purple-600 shadow-xs dark:bg-slate-800 dark:text-purple-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{t.architecture.tabComparisons} ({SERVICE_COMPARISONS.length})</span>
          </button>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'services'
                ? 'Search services by name, acronym (EC2, KMS), concepts...'
                : 'Search comparisons (e.g. S3 vs EBS, ALB vs NLB, Multi-AZ)...'
            }
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 shadow-xs placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        {activeTab === 'services' ? (
          <div className="flex overflow-x-auto gap-1.5 pb-1 sm:pb-0">
            {serviceCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-1.5 pb-1 sm:pb-0">
            {compCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCompCategory(cat)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedCompCategory === cat
                    ? 'bg-purple-600 text-white shadow-xs dark:bg-purple-500'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: AWS SERVICES DIRECTORY */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Services List Column */}
          <div className="space-y-3 lg:col-span-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Services ({filteredServices.length})
            </h2>
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {filteredServices.map((service) => {
                const isSelected = selectedService?.id === service.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleSelectService(service)}
                    className={`flex w-full items-start justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {service.name}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {service.category}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {service.summary}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        isSelected ? 'text-blue-600 dark:text-blue-400' : ''
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Detail View Column */}
          <div ref={detailRef} className="lg:col-span-2">
            {selectedService ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                        {selectedService.name}
                      </h2>
                      {selectedService.abbreviation && (
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {selectedService.abbreviation}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {selectedService.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSelectServiceToStudy && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectServiceToStudy(
                            selectedService.abbreviation || selectedService.name
                          )
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Practice Questions</span>
                      </button>
                    )}
                    <a
                      href={selectedService.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <span>Docs</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>
                  </div>
                </div>

                {/* Core Concepts */}
                <div className="mt-6 space-y-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    Core Architecture Concepts
                  </h3>
                  <ul className="space-y-2">
                    {selectedService.coreConcepts.map((concept, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                        <span>{concept}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exam Relevance */}
                <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-950 dark:bg-blue-950/30">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    SAA-C03 Exam Relevance
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-blue-950 dark:text-blue-200">
                    {selectedService.examRelevance}
                  </p>
                </div>

                {/* Common Traps */}
                {selectedService.commonTraps.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4 dark:border-amber-950 dark:bg-amber-950/30">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      High-Frequency Exam Traps & Distractors
                    </h4>
                    <ul className="mt-2 space-y-1.5">
                      {selectedService.commonTraps.map((trap, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs leading-relaxed text-amber-950 dark:text-amber-200"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span>{trap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
                <Server className="h-10 w-10 text-slate-400" />
                <h3 className="mt-3 text-base font-bold text-slate-700 dark:text-slate-300">
                  Select an AWS Service
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  Choose any service from the left directory to inspect its core exam topics, architectural trade-offs, and trap warnings.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ARCHITECTURAL COMPARISONS */}
      {activeTab === 'comparisons' && (
        <div className="space-y-6">
          {/* Quick Comparison Selector Strip */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Table className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                Architectural Comparisons ({filteredComparisons.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Click any comparison to view its table matrix
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredComparisons.map((comp) => {
                const isSelected = selectedComparison?.id === comp.id;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => handleSelectComparison(comp)}
                    className={`rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50/80 shadow-xs ring-1 ring-purple-500/30 dark:border-purple-400 dark:bg-purple-950/60'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {comp.category}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Viewing
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {comp.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {comp.services.join(' • ')}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Side-by-Side Comparison Table with Highlighted Keywords */}
          {selectedComparison ? (
            <div ref={compDetailRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              {/* Header Title & Legend */}
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      {selectedComparison.category}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Detailed Architectural Comparison Table
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-black text-slate-900 dark:text-slate-100 sm:text-xl">
                    {selectedComparison.title}
                  </h2>
                </div>

                {/* Keyword Legend Pill */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Key Highlights:</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    Stateful / Sync / Multi-AZ
                  </span>
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 font-bold text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                    Stateless
                  </span>
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                    Single AZ / Cannot
                  </span>
                </div>
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <span>↔ Vuốt ngang để so sánh tất cả các dịch vụ</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 scroll-touch">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-800/80">
                      <th className="w-1/4 p-3.5 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Architectural Dimension
                      </th>
                      {selectedComparison.services.map((srv, idx) => (
                        <th
                          key={srv}
                          className={`p-3.5 font-bold text-sm ${
                            idx === 0
                              ? 'text-blue-700 dark:text-blue-300'
                              : idx === 1
                              ? 'text-purple-700 dark:text-purple-300'
                              : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-current" />
                            <span>{srv}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {selectedComparison.dimensions.map((dim, rowIdx) => (
                      <tr
                        key={dim.name}
                        className={`transition-colors ${
                          rowIdx % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/60 dark:bg-slate-800/30'
                        } hover:bg-blue-50/40 dark:hover:bg-blue-950/20`}
                      >
                        <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                          {dim.name}
                        </td>
                        {selectedComparison.services.map((srv) => (
                          <td
                            key={srv}
                            className="p-3.5 leading-relaxed text-slate-700 dark:text-slate-300 text-xs"
                          >
                            <KeywordHighlighter text={dim.description[srv] || 'N/A'} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actionable Exam Guidance Banners */}
              <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {/* Exam Selection Rule */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-950 dark:bg-blue-950/40">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    How to Choose on the Exam
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-blue-950 dark:text-blue-200">
                    <KeywordHighlighter text={selectedComparison.examTip} />
                  </p>
                </div>

                {/* Common Distractor Trap */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-950 dark:bg-amber-950/40">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    High-Frequency Exam Trap
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-950 dark:text-amber-200">
                    <KeywordHighlighter text={selectedComparison.commonTrap} />
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
              <Layers className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                Click any comparison card above to view its detailed side-by-side matrix.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
