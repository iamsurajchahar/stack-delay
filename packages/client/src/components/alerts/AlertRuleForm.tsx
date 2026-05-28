import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  onSubmit: (data: any) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

const ruleTypes = [
  { value: 'score_drop', label: 'Score drops below threshold' },
  { value: 'eol_approaching', label: 'EOL approaching' },
  { value: 'new_cve', label: 'New vulnerability discovered' },
  { value: 'grade_change', label: 'Grade worsens' },
  { value: 'deprecated_dep', label: 'Dependency deprecated' },
];

export function AlertRuleForm({ onSubmit, onClose, isSubmitting }: Props) {
  const [ruleType, setRuleType] = useState('score_drop');
  const [thresholdValue, setThresholdValue] = useState(50);
  const [thresholdDays, setThresholdDays] = useState(90);
  const [channels, setChannels] = useState<string[]>(['email']);

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ruleType,
      thresholdValue: ruleType === 'score_drop' ? thresholdValue : undefined,
      thresholdDays: ruleType === 'eol_approaching' ? thresholdDays : undefined,
      channels,
      isEnabled: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Create Alert Rule</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Rule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ruleTypes.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>

          {/* Score threshold */}
          {ruleType === 'score_drop' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Score Threshold: {thresholdValue}
              </label>
              <input
                type="range"
                min="10"
                max="90"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>10 (Critical)</span>
                <span>90 (Strict)</span>
              </div>
            </div>
          )}

          {/* Days threshold */}
          {ruleType === 'eol_approaching' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Days before EOL</label>
              <select
                value={thresholdDays}
                onChange={(e) => setThresholdDays(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>
          )}

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notification Channels</label>
            <div className="flex gap-3">
              {['email', 'webhook', 'slack'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    channels.includes(ch)
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || channels.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
