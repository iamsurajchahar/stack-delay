import { useState } from 'react';
import { Plus, Trash2, Webhook, CheckCircle, XCircle } from 'lucide-react';

interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: string;
}

export function WebhookConfig() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['score_change', 'new_cve']);

  const eventOptions = [
    { value: 'score_change', label: 'Score Change' },
    { value: 'new_cve', label: 'New CVE' },
    { value: 'grade_change', label: 'Grade Change' },
    { value: 'scan_complete', label: 'Scan Complete' },
    { value: 'eol_warning', label: 'EOL Warning' },
  ];

  const toggleEvent = (ev: string) => {
    setNewEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const addWebhook = () => {
    if (!newUrl) return;
    setWebhooks((prev) => [
      ...prev,
      { id: Date.now().toString(), url: newUrl, events: newEvents, isActive: true },
    ]);
    setNewUrl('');
    setNewEvents(['score_change', 'new_cve']);
    setShowAdd(false);
  };

  const removeWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <div className="bg-white border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Webhook Endpoints</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      {webhooks.length === 0 && !showAdd && (
        <p className="text-sm text-gray-500 py-4 text-center">
          No webhooks configured. Add one to receive HTTP POST notifications.
        </p>
      )}

      <div className="space-y-3">
        {webhooks.map((wh) => (
          <div key={wh.id} className="flex items-center justify-between border rounded-lg p-3">
            <div className="flex items-center gap-3">
              <Webhook className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-mono text-gray-700">
                  {wh.url.replace(/(https?:\/\/[^/]+)(.*)/, '$1/***')}
                </p>
                <div className="flex gap-1 mt-1">
                  {wh.events.map((ev) => (
                    <span key={ev} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {ev.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {wh.isActive ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-gray-400" />
              )}
              <button onClick={() => removeWebhook(wh.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="mt-4 border rounded-lg p-4 bg-gray-50 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks/stack-decay"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Events</label>
            <div className="flex flex-wrap gap-2">
              {eventOptions.map((ev) => (
                <button
                  key={ev.value}
                  type="button"
                  onClick={() => toggleEvent(ev.value)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    newEvents.includes(ev.value)
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-600">Cancel</button>
            <button onClick={addWebhook} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
