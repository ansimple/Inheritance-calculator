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
    <div className="flex flex-col h-screen bg-brown-950 text-stone-100 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-brown-800 bg-brown-900/95 backdrop-blur px-3 sm:px-4 flex items-center justify-between z-20 shrink-0">
        {/* Logo and Brand (Without '상' icon) */}
        <div className="flex items-center min-w-0">
          <h1 className="text-xs sm:text-sm font-semibold tracking-tight text-stone-100 flex items-center gap-2 truncate">
            <span className="font-bold tracking-normal text-amber-400 truncate">상속 계산기</span>
            <span className="hidden sm:inline text-stone-300 font-normal">대한민국 상속 분배 및 유류분</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono font-medium shrink-0">
              2026 전면 개정
            </span>
          </h1>
        </div>

        {/* View Switching Tabs (Desktop: hidden on mobile) */}
        <div className="hidden md:flex items-center bg-brown-950/90 p-1 rounded-xl border border-brown-800">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'wizard'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-brown-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            단계별 마법사
          </button>
          <button
            onClick={() => setActiveTab('canvas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'canvas'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-brown-900'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            가계도 다이어그램
          </button>
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'visualizer'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-brown-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            계산과정 도식화
          </button>
        </div>

        {/* Actions (Undo/Redo & Export) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center border-r border-brown-800 pr-1.5 sm:pr-2 mr-0.5 sm:mr-1 gap-0.5 sm:gap-1">
            <button 
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              className={`p-1.5 rounded-lg transition ${
                canUndo 
                  ? 'text-stone-300 hover:text-white hover:bg-brown-850' 
                  : 'text-stone-600 cursor-not-allowed'
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
                  ? 'text-stone-300 hover:text-white hover:bg-brown-850' 
                  : 'text-stone-600 cursor-not-allowed'
              }`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={handleExportExcel}
            title="엑셀 다운로드 (.xlsx)"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isExported
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/60'
            }`}
          >
            {isExported ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 pointer-events-none" />
                <span className="hidden sm:inline">다운로드 완료!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 pointer-events-none" />
                <span className="hidden sm:inline">엑셀</span>
                <span className="hidden md:inline">다운로드</span>
              </>
            )}
          </button>
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            title="보고서 인쇄 및 PDF 저장"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-brown-850 text-stone-200 hover:bg-brown-800 border border-brown-700/60 text-xs font-medium transition"
          >
            <Printer className="w-3.5 h-3.5 pointer-events-none" />
            <span className="hidden sm:inline">인쇄</span>
            <span className="hidden md:inline">/ PDF</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 relative overflow-hidden bg-brown-950 pb-16 md:pb-0">
        {activeTab === 'wizard' && <WizardContainer />}
        {activeTab === 'canvas' && <FamilyTreeCanvas />}
        {activeTab === 'visualizer' && <PipelineFlowGraph />}
      </main>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile/tablet) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-brown-900/95 border-t border-brown-800 backdrop-blur-lg z-30 flex items-center justify-around px-2 shadow-2xl safe-area-pb">
        <button
          onClick={() => setActiveTab('wizard')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 text-[11px] font-medium transition-colors ${
            activeTab === 'wizard'
              ? 'text-amber-400 font-bold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition ${activeTab === 'wizard' ? 'bg-amber-500/20' : ''}`}>
            <Users className="w-5 h-5" />
          </div>
          <span>마법사</span>
        </button>

        <button
          onClick={() => setActiveTab('canvas')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 text-[11px] font-medium transition-colors ${
            activeTab === 'canvas'
              ? 'text-amber-400 font-bold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition ${activeTab === 'canvas' ? 'bg-amber-500/20' : ''}`}>
            <GitFork className="w-5 h-5" />
          </div>
          <span>가계도</span>
        </button>

        <button
          onClick={() => setActiveTab('visualizer')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 text-[11px] font-medium transition-colors ${
            activeTab === 'visualizer'
              ? 'text-amber-400 font-bold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition ${activeTab === 'visualizer' ? 'bg-amber-500/20' : ''}`}>
            <Calculator className="w-5 h-5" />
          </div>
          <span>계산과정</span>
        </button>
      </nav>

      {/* Print / PDF Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />

      {/* Download Success Toast Notification */}
      {downloadSuccessToast && (
        <div className="fixed top-16 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 flex items-center gap-3 bg-brown-900/95 text-emerald-200 border border-emerald-600/50 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md transition-all duration-300 ring-1 ring-emerald-500/30">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="text-xs min-w-0">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>엑셀 다운로드 완료</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-normal">저장됨</span>
            </div>
            <div className="text-emerald-300 font-mono text-[11px] truncate mt-0.5">
              {downloadSuccessToast}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              브라우저 다운로드 폴더에 저장되었습니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
