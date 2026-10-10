import React, { useState } from 'react';
import { Header } from './components/Header';
import { PdfEditorView } from './components/PdfEditorView';
import { PdfMergeView } from './components/PdfMergeView';

export function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'merge'>('editor');
  const [sharedPdfBytes, setSharedPdfBytes] = useState<ArrayBuffer | null>(null);
  const [sharedFileName, setSharedFileName] = useState<string>('Dokument.pdf');

  // When Editor updates its working document
  const handleEditorPdfUpdate = (bytes: ArrayBuffer, fileName: string) => {
    setSharedPdfBytes(bytes);
    setSharedFileName(fileName);
  };

  // When Merge/Organizer view updates or finishes organizing pages
  const handleMergeSyncToEditor = (bytes: ArrayBuffer, fileName: string) => {
    setSharedPdfBytes(bytes);
    setSharedFileName(fileName);
    setActiveTab('editor'); // automatically switch to editor
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F]">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-hidden relative">
        {/* We keep both views mounted and toggle visibility so no user state or uploads are lost! */}
        <div className={`h-full w-full ${activeTab === 'editor' ? 'block' : 'hidden'}`}>
          <PdfEditorView
            sharedPdfBytes={sharedPdfBytes}
            sharedFileName={sharedFileName}
            onPdfUpdate={handleEditorPdfUpdate}
            onOpenMergeTab={() => setActiveTab('merge')}
          />
        </div>

        <div className={`h-full w-full ${activeTab === 'merge' ? 'block' : 'hidden'}`}>
          <PdfMergeView
            sharedPdfBytes={sharedPdfBytes}
            sharedFileName={sharedFileName}
            onSyncToEditor={handleMergeSyncToEditor}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
