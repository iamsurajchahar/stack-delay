import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus } from 'lucide-react';
import { listRules, createRule, deleteRule, getAlertHistory } from '../../api/alerts';
import { AlertRuleCard } from './AlertRuleCard';
import { AlertRuleForm } from './AlertRuleForm';
import { AlertHistory } from './AlertHistory';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { EmptyState } from '../shared/EmptyState';

export function AlertsPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeSection, setActiveSection] = useState<'rules' | 'history'>('rules');
  const queryClient = useQueryClient();

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: listRules,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['alert-history'],
    queryFn: () => getAlertHistory({}),
  });

  const createMutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Get notified when your stack health changes</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveSection('rules')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeSection === 'rules' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Rules ({rules?.length || 0})
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeSection === 'history' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          History ({history?.items?.length || 0})
        </button>
      </div>

      {activeSection === 'rules' && (
        <>
          {rulesLoading ? (
            <LoadingSpinner />
          ) : !rules || rules.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No alert rules"
              description="Create your first alert rule to get notified about score drops, new vulnerabilities, and EOL warnings."
              actionLabel="Create Rule"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="grid gap-4">
              {rules.map((rule: any) => (
                <AlertRuleCard
                  key={rule.id || rule._id}
                  rule={rule}
                  onDelete={() => deleteMutation.mutate(rule.id || rule._id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeSection === 'history' && (
        historyLoading ? <LoadingSpinner /> : <AlertHistory notifications={history?.items || []} />
      )}

      {showForm && (
        <AlertRuleForm
          onSubmit={(data) => createMutation.mutate(data)}
          onClose={() => setShowForm(false)}
          isSubmitting={createMutation.isPending}
        />
      )}
    </div>
  );
}
