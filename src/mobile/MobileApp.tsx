import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { Camera, FileText, ImageUp, Info, Lock, LoaderCircle, Search, Share, Smartphone, WifiOff } from 'lucide-react';
import { APP_VERSION } from '../config';

const MobileImageEditor = lazy(() => import('./MobileImageEditor'));
const MobilePdfEditor = lazy(() => import('./MobilePdfEditor'));

type Tab = 'image' | 'pdf' | 'info';

export default function MobileApp() {
  const [tab, setTab] = useState<Tab>('image');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const editing = (tab === 'image' && imageFile) || (tab === 'pdf' && pdfFile);

  const loading = (
    <div className="flex h-full items-center justify-center">
      <LoaderCircle className="h-6 w-6 animate-spin text-[#0071E3]" />
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-[#F5F5F7]">
      <main className="min-h-0 flex-1">
        {tab === 'image' &&
          (imageFile ? (
            <Suspense fallback={loading}>
              <MobileImageEditor file={imageFile} onClose={() => setImageFile(null)} />
            </Suspense>
          ) : (
            <ImageStart onFile={setImageFile} />
          ))}
        {tab === 'pdf' &&
          (pdfFile ? (
            <Suspense fallback={loading}>
              <MobilePdfEditor file={pdfFile} onClose={() => setPdfFile(null)} />
            </Suspense>
          ) : (
            <PdfStart onFile={setPdfFile} />
          ))}
        {tab === 'info' && <InfoPage />}
      </main>

      {!editing && (
        <nav className="safe-bottom safe-x shrink-0 border-t border-black/5 bg-white/95 backdrop-blur">
          <div className="flex px-2 pt-1.5">
            <TabButton active={tab === 'image'} onClick={() => setTab('image')} icon={<ImageUp className="h-6 w-6" />} label="Bild" />
            <TabButton active={tab === 'pdf'} onClick={() => setTab('pdf')} icon={<FileText className="h-6 w-6" />} label="PDF" />
            <TabButton active={tab === 'info'} onClick={() => setTab('info')} icon={<Info className="h-6 w-6" />} label="Info" />
          </div>
        </nav>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${active ? 'text-[#0071E3]' : 'text-[#8E8E93]'}`}>
      {icon}
      {label}
    </button>
  );
}

function StartLayout({ title, subtitle, children, notes }: { title: string; subtitle: string; children: ReactNode; notes: ReactNode }) {
  return (
    <div className="safe-top safe-x h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-5 pb-8 pt-8">
        <div className="mb-1 text-[13px] font-semibold text-[#0071E3]">Toolbox</div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 text-[15px] leading-snug text-[#6E6E73]">{subtitle}</p>
        <div className="mt-6 space-y-3">{children}</div>
        <div className="mt-6 space-y-2.5">{notes}</div>
      </div>
    </div>
  );
}

function BigButton({ icon, title, text, onClick, primary }: { icon: ReactNode; title: string; text: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-sm ${primary ? 'bg-[#0071E3] text-white active:bg-[#0062C4]' : 'bg-white active:bg-[#F0F0F2]'}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-white/20' : 'bg-[#0071E3]/10 text-[#0071E3]'}`}>{icon}</span>
      <span>
        <span className="block text-[16px] font-semibold">{title}</span>
        <span className={`block text-[13px] leading-snug ${primary ? 'text-white/80' : 'text-[#6E6E73]'}`}>{text}</span>
      </span>
    </button>
  );
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] leading-snug text-[#6E6E73]">
      <span className="mt-0.5 text-[#34C759]">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

const PRIVACY_NOTE = (
  <Note icon={<Lock className="h-4 w-4" />}>
    Alles bleibt auf deinem Gerät. Bilder und PDFs werden nirgendwo hochgeladen.
  </Note>
);

function ImageStart({ onFile }: { onFile: (f: File) => void }) {
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onFile(f);
  };
  return (
    <StartLayout
      title="Bilder unkenntlich machen"
      subtitle="Gesichter, Kennzeichen, Namen oder Adressen auf Fotos und Bildschirmfotos verpixeln, weichzeichnen oder abdecken."
      notes={
        <>
          {PRIVACY_NOTE}
          <Note icon={<Smartphone className="h-4 w-4" />}>Gespeichert wird eine Kopie ohne Aufnahmeort (GPS) und Kameradaten.</Note>
        </>
      }
    >
      <BigButton primary icon={<ImageUp className="h-6 w-6" />} title="Foto auswählen" text="Aus deiner Galerie oder deinen Dateien" onClick={() => pickRef.current?.click()} />
      <BigButton icon={<Camera className="h-6 w-6" />} title="Foto aufnehmen" text="Direkt mit der Kamera" onClick={() => cameraRef.current?.click()} />
      <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={take} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={take} />
    </StartLayout>
  );
}

function PdfStart({ onFile }: { onFile: (f: File) => void }) {
  const pickRef = useRef<HTMLInputElement>(null);
  return (
    <StartLayout
      title="PDF unkenntlich machen"
      subtitle="Namen, IBAN, Adressen oder ganze Textpassagen schwärzen, verpixeln oder weichzeichnen – bevor du ein Dokument weitergibst."
      notes={
        <>
          {PRIVACY_NOTE}
          <Note icon={<Search className="h-4 w-4" />}>„Suchen“ findet Begriffe, IBANs, E-Mail-Adressen und Telefonnummern automatisch.</Note>
          <Note icon={<FileText className="h-4 w-4" />}>Der Text unter einer Schwärzung wird beim Sichern wirklich entfernt, nicht nur überdeckt.</Note>
        </>
      }
    >
      <BigButton primary icon={<FileText className="h-6 w-6" />} title="PDF öffnen" text="Aus Dateien, iCloud, Downloads …" onClick={() => pickRef.current?.click()} />
      <input
        ref={pickRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </StartLayout>
  );
}

function InfoPage() {
  const isStandalone =
    typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return (
    <div className="safe-top safe-x h-full overflow-y-auto">
      <div className="mx-auto max-w-md space-y-4 px-5 pb-8 pt-8">
        <div>
          <div className="mb-1 text-[13px] font-semibold text-[#0071E3]">Toolbox</div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">PDF, Bilder & mehr</h1>
          <p className="mt-2 text-[15px] leading-snug text-[#6E6E73]">Die kleine Toolbox für unterwegs. Version {APP_VERSION}.</p>
        </div>

        {!isStandalone && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <Smartphone className="h-5 w-5 text-[#0071E3]" />
              Als App auf den Homescreen
            </h2>
            {isIos ? (
              <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-snug text-[#3A3A3C]">
                <li>
                  In Safari unten auf <Share className="inline h-4 w-4 -translate-y-px text-[#0071E3]" /> „Teilen“ tippen.
                </li>
                <li>„Zum Home-Bildschirm“ wählen.</li>
                <li>„Hinzufügen“ tippen – fertig.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-snug text-[#3A3A3C]">
                <li>Im Browser oben rechts das Menü (⋮) öffnen.</li>
                <li>„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.</li>
              </ol>
            )}
          </section>
        )}

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <Note icon={<Lock className="h-4 w-4" />}>
            <b className="text-[#1D1D1F]">Privat:</b> Alle Bilder und PDFs werden nur auf deinem Gerät bearbeitet. Es gibt kein Konto, keinen Upload und keine
            Werbung.
          </Note>
          <Note icon={<WifiOff className="h-4 w-4" />}>
            <b className="text-[#1D1D1F]">Offline:</b> Einmal geöffnet, funktioniert die Toolbox auch ohne Internet.
          </Note>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1.5 text-[15px] font-semibold">Mehr Funktionen am Computer</h2>
          <p className="text-[14px] leading-snug text-[#3A3A3C]">
            Die Toolbox für Mac und Windows kann zusätzlich PDFs bearbeiten und unterschreiben, zusammenführen, komprimieren, E-Rechnungen auslesen und
            E-Mail-Signaturen gestalten.
          </p>
          {location.pathname.includes('/mobil/') && (
            <a href="../?desktop" className="mr-2 mt-3 inline-flex items-center rounded-full bg-[#F5F5F7] px-4 py-2 text-sm font-semibold text-[#0071E3]">
              Volle Version im Browser
            </a>
          )}
          <a
            href="https://app.pberthold.com/marketplace"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center rounded-full bg-[#F5F5F7] px-4 py-2 text-sm font-semibold text-[#0071E3]"
          >
            Im Marketplace von NotionaryAtlas
          </a>
        </section>
      </div>
    </div>
  );
}
