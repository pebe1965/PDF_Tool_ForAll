import React, { useState } from 'react';
import { Header, AppTab } from './components/Header';
import { PdfEditorView } from './components/PdfEditorView';
import { PdfMergeView } from './components/PdfMergeView';
import { PdfToolsView } from './components/PdfToolsView';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [sharedPdfBytes, setSharedPdfBytes] = useState<ArrayBuffer | null>(null);
  const [sharedFileName, setSharedFileName] = useState<string>('Dokument.pdf');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // When Editor updates its working document
  const handleEditorPdfUpdate = (bytes: ArrayBuffer, fileName: string) => {
    setSharedPdfBytes(bytes);
    setSharedFileName(fileName);
  };

  // When Merge/Organizer or Tools view updates or finishes organizing pages
  const handleSyncToEditor = (bytes: ArrayBuffer, fileName: string) => {
    setSharedPdfBytes(bytes);
    setSharedFileName(fileName);
    setActiveTab('editor');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F]">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveDocument={Boolean(sharedPdfBytes)}
        onOpenAiAssistant={() => {
          setActiveTab('editor');
          setIsAiModalOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <main className="flex-1 overflow-hidden relative">
        {/* Keep views mounted and toggle visibility so no user state or uploads are lost */}
        <div className={`h-full w-full ${activeTab === 'home' || activeTab === 'editor' ? 'block' : 'hidden'}`}>
          <PdfEditorView
            sharedPdfBytes={sharedPdfBytes}
            sharedFileName={sharedFileName}
            onPdfUpdate={handleEditorPdfUpdate}
            onOpenMergeTab={() => setActiveTab('merge')}
            onOpenToolsTab={() => setActiveTab('tools')}
            onGoHome={() => setActiveTab('home')}
            isHomeView={activeTab === 'home'}
            onGoToEditor={() => setActiveTab('editor')}
            isAiModalOpen={isAiModalOpen}
            onToggleAiModal={setIsAiModalOpen}
          />
        </div>

        <div className={`h-full w-full ${activeTab === 'merge' ? 'block' : 'hidden'}`}>
          <PdfMergeView
            sharedPdfBytes={sharedPdfBytes}
            sharedFileName={sharedFileName}
            onSyncToEditor={handleSyncToEditor}
            onGoHome={() => setActiveTab('home')}
          />
        </div>

        <div className={`h-full w-full ${activeTab === 'tools' ? 'block' : 'hidden'}`}>
          <PdfToolsView
            sharedPdfBytes={sharedPdfBytes}
            sharedFileName={sharedFileName}
            onSyncToEditor={handleSyncToEditor}
            onGoHome={() => setActiveTab('home')}
          />
        </div>
      </main>

      {/* Global Settings & Update Check Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
