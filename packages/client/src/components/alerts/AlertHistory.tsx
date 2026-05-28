import { Mail, Webhook, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';

interface Props {
  notifications: any[];
}

const channelIcons: Record<string, any> = {
  email: Mail,
  webhook: Webhook,
  slack: MessageSquare,
};

const statusConfig: Record<string, { icon: any; color: string }> = {
  sent: { icon: CheckCircle, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  pending: { icon: Clock, color: 'text-yellow-500' },
};

export function AlertHistory({ notifications }: Props) {
  if (!notifications || notifications.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No notification history"
        description="Notifications will appear here once your alert rules are triggered."
      />
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {notifications.map((notif: any, i: number) => {
            const ChannelIcon = channelIcons[notif.channel] || Mail;
            const status = statusConfig[notif.status] || statusConfig.pending;
            const StatusIcon = status.icon;

            return (
              <tr key={notif.id || notif._id || i} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ChannelIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm capitalize">{notif.channel}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                  {notif.subject}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <StatusIcon className={`w-4 h-4 ${status.color}`} />
                    <span className="text-sm capitalize">{notif.status}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
