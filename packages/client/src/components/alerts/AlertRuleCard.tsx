import { Trash2, TrendingDown, Clock, ShieldAlert, ArrowDownCircle, AlertTriangle } from 'lucide-react';

interface Props {
  rule: any;
  onDelete: () => void;
}

const ruleTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  score_drop: { label: 'Score Drop', icon: TrendingDown, color: 'text-red-600 bg-red-50' },
  eol_approaching: { label: 'EOL Approaching', icon: Clock, color: 'text-orange-600 bg-orange-50' },
  new_cve: { label: 'New CVE', icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
  grade_change: { label: 'Grade Change', icon: ArrowDownCircle, color: 'text-yellow-600 bg-yellow-50' },
  deprecated_dep: { label: 'Deprecated Dependency', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
};

export function AlertRuleCard({ rule, onDelete }: Props) {
  const config = ruleTypeConfig[rule.ruleType] || ruleTypeConfig.score_drop;
  const Icon = config.icon;

  return (
    <div className="bg-white border rounded-lg p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{config.label}</h3>
          <p className="text-sm text-gray-500">
            {rule.ruleType === 'score_drop' && `Alert when score drops below ${rule.thresholdValue || 50}`}
            {rule.ruleType === 'eol_approaching' && `Alert ${rule.thresholdDays || 90} days before EOL`}
            {rule.ruleType === 'new_cve' && 'Alert on any new vulnerability'}
            {rule.ruleType === 'grade_change' && 'Alert when grade worsens'}
            {rule.ruleType === 'deprecated_dep' && 'Alert when a dependency is deprecated'}
          </p>
          <div className="flex gap-2 mt-1">
            {rule.repositoryId ? (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Specific repo</span>
            ) : (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">All repos</span>
            )}
            {(rule.channels || []).map((ch: string) => (
              <span key={ch} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">{ch}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-1 rounded-full ${rule.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {rule.isEnabled ? 'Active' : 'Paused'}
        </span>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
