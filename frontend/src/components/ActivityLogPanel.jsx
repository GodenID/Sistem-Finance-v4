import React, { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { getActivityLogsByRecord, getActionLabel, getActionBadgeColor } from '../lib/auditLog';

const ActivityLogPanel = ({ recordId, title = "Riwayat Aktivitas" }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!recordId) return;
      
      try {
        setIsLoading(true);
        const data = await getActivityLogsByRecord(recordId);
        setLogs(data);
      } catch (error) {
        console.error('Error fetching activity logs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [recordId]);

  if (!recordId) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {logs.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-gray-600">Memuat...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-4">
              <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada riwayat aktivitas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => (
                <div 
                  key={log.id} 
                  className={`relative pl-6 ${index !== logs.length - 1 ? 'pb-3 border-l-2 border-gray-200' : ''}`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-0 w-3 h-3 bg-white border-2 border-primary-500 rounded-full -translate-x-1.5"></div>
                  
                  {/* Log content */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getActionBadgeColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.changed_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    {/* Detail */}
                    {log.field_changed && (
                      <div className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">{log.field_changed}:</span>
                        {log.old_value && (
                          <span className="text-rose-600 line-through ml-1">{log.old_value}</span>
                        )}
                        {log.old_value && log.new_value && (
                          <span className="text-gray-400 mx-1">→</span>
                        )}
                        {log.new_value && (
                          <span className="text-emerald-600">{log.new_value}</span>
                        )}
                      </div>
                    )}
                    
                    {/* User info */}
                    <div className="text-xs text-gray-500">
                      oleh <span className="font-medium text-gray-700">{log.changed_by_name || 'System'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityLogPanel;
