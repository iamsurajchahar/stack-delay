import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RepoSelector } from './RepoSelector';
import { InitialScanProgress } from './InitialScanProgress';

const steps = ['Select Repos', 'Scan Frequency', 'Initial Scan'];

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [selectedRepos, setSelectedRepos] = useState<any[]>([]);
  const [scanFrequency, setScanFrequency] = useState('weekly');
  const [connectedRepoIds, setConnectedRepoIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleReposSelected = (repos: any[]) => {
    setSelectedRepos(repos);
    setStep(1);
  };

  const handleFrequencySelected = async () => {
    // In production, this would call the API to connect repos
    const ids = selectedRepos.map((r) => r.id || r.github_repo_id);
    setConnectedRepoIds(ids);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i + 1}
              </div>
              <span className={`ml-2 text-sm ${i <= step ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
              {i < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-3 ${i < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          {step === 0 && (
            <RepoSelector onSelect={handleReposSelected} />
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Scan Frequency</h2>
                <p className="text-sm text-gray-500 mt-1">
                  How often should we check your {selectedRepos.length} repos?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'daily', label: 'Daily', desc: 'Best for active projects' },
                  { value: 'weekly', label: 'Weekly', desc: 'Recommended for most teams' },
                  { value: 'monthly', label: 'Monthly', desc: 'For stable, low-change repos' },
                  { value: 'manual', label: 'Manual Only', desc: 'Scan on demand' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setScanFrequency(opt.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      scanFrequency === opt.value
                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(0)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={handleFrequencySelected}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Scanning
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <InitialScanProgress
              repoIds={connectedRepoIds}
              onComplete={() => navigate('/')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
