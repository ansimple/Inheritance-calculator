import { useState, useEffect } from 'react';
import { 
  Users, 
  GitFork, 
  Calculator, 
  FileSpreadsheet, 
  Printer, 
  RotateCcw, 
  RotateCw,
  CheckCircle,
} from 'lucide-react';
import { useInheritanceStore } from './state/useInheritanceStore';
import { WizardContainer } from './components/wizard/WizardContainer';
import { FamilyTreeCanvas } from './components/canvas/FamilyTreeCanvas';
import { PipelineFlowGraph } from './components/visualizer/PipelineFlowGraph';
import { PrintReportModal } from './components/reports/PrintReportModal';
import { ExcelExportService } from './reports/ExcelExportService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'wizard' | 'canvas' | 'visualizer'>('wizard');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);
  const [isExported, setIsExported] = useState(false);

  const {
    deceasedId,
    allPersons,
    relationships,
    estate,
    calculationResult,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useInheritanceStore();

  // Keyboard shortcut listener (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleExportExcel = () => {
    if (!calculationResult) {
      alert('상속 계산 결과가 아직 준비되지 않았습니다.');
      return;
    }
    const deceased = allPersons.get(deceasedId);
    if (!deceased) {
      alert('피상속인 정보가 없습니다.');
      return;
    }

    try {
      const fileName = ExcelExportService.exportToExcel({
        deceased,
        allPersons,
        relationships,
        estate,
        result: calculationResult,
      });

      setIsExported(true);
      setDownloadSuccessToast(fileName);

      setTimeout(() => {
        setIsExported(false);
      }, 2500);

      setTimeout(() => {
        setDownloadSuccessToast(null);
      }, 4500);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold text-sm">
            상
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
              대한민국 상속 분배 및 유류분 계산기
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                2000~2026 전면 개정
              </span>
            </h1>
          </div>
        </div>

        {/* View Switching Tabs */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'wizard'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            단계별 마법사
          </button>
          <button
            onClick={() => setActiveTab('canvas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'canvas'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            가계도 다이어그램
          </button>
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'visualizer'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            계산과정 도식화
          </button>
        </div>

        {/* Actions (Undo/Redo & Export) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border-r border-slate-800 pr-2 mr-1 gap-1">
            <button 
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              className={`p-1.5 rounded-lg transition ${
                canUndo 
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Y)"
              className={`p-1.5 rounded-lg transition ${
                canRedo 
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={handleExportExcel}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isExported
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
            }`}
          >
            {isExported ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 pointer-events-none" />
                다운로드 완료!
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 pointer-events-none" />
                엑셀 다운로드
              </>
            )}
          </button>
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium transition"
          >
            <Printer className="w-3.5 h-3.5 pointer-events-none" />
            인쇄 / PDF
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 relative overflow-hidden bg-slate-950">
        {activeTab === 'wizard' && <WizardContainer />}
        {activeTab === 'canvas' && <FamilyTreeCanvas />}
        {activeTab === 'visualizer' && <PipelineFlowGraph />}
      </main>

      {/* Print / PDF Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />

      {/* Download Success Toast Notification */}
      {downloadSuccessToast && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-3 bg-slate-900/95 text-emerald-200 border border-emerald-500/50 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md transition-all duration-300 ring-1 ring-emerald-500/30">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>엑셀 다운로드 완료</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-normal">저장됨</span>
            </div>
            <div className="text-emerald-300 font-mono text-[11px] truncate max-w-xs mt-0.5">
              {downloadSuccessToast}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              브라우저 다운로드 폴더에 저장되었습니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
