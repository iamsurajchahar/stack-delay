import { useState } from 'react';
import { Bell } from 'lucide-react';

export function NotificationPrefs() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState('immediate');

  return (
    <div className="bg-white border rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>

      <div className="space-y-4">
        {/* Email toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">Email Notifications</p>
              <p className="text-sm text-gray-500">Receive alerts via email</p>
            </div>
          </div>
          <button
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${emailEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${emailEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Digest frequency */}
        <div className="py-2">
          <p className="font-medium text-gray-900 mb-2">Digest Frequency</p>
          <div className="flex gap-2">
            {[
              { value: 'immediate', label: 'Immediate' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDigestFrequency(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  digestFrequency === opt.value
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
