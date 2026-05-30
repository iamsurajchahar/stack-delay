import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown, FileDown } from 'lucide-react';

interface ExportMenuProps {
  repoId: string;
}

export function ExportMenu({ repoId }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem('auth_token');

  const exports = [
    { label: 'Full Report (PDF)', icon: FileDown, path: `/api/repos/${repoId}/export/pdf` },
    { label: 'Dependencies (CSV)', icon: FileSpreadsheet, path: `/api/repos/${repoId}/export/dependencies` },
    { label: 'Vulnerabilities (CSV)', icon: FileSpreadsheet, path: `/api/repos/${repoId}/export/vulnerabilities` },
    { label: 'Full Report (TXT)', icon: FileText, path: `/api/repos/${repoId}/export/report` },
  ];

  const handleExport = (path: string) => {
    // Create a temporary link with auth header via fetch
    fetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const disposition = res.headers.get('Content-Disposition');
        const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'export.csv';
        return res.blob().then(blob => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary gap-1.5"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {exports.map(({ label, icon: Icon, path }) => (
              <button
                key={path}
                onClick={() => handleExport(path)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Icon className="h-4 w-4 text-gray-400" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
