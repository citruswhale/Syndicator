import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function TimelineVisualization({ timelineData }) {
  const sortedEvents = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return [];
    return [...timelineData].sort((a, b) => a.unix_time - b.unix_time);
  }, [timelineData]);

  if (!sortedEvents || sortedEvents.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">
          📅 Fraud Transaction Timeline
        </h3>
        <p className="text-gray-500 text-sm">No timeline data available</p>
      </div>
    );
  }

  // Get time range
  const startTime = new Date(sortedEvents[0].timestamp);
  const endTime = new Date(sortedEvents[sortedEvents.length - 1].timestamp);
  const totalDuration = endTime - startTime;

  // Sample events if too many (show max 100 for performance)
  const displayEvents = sortedEvents.length > 100
    ? sortedEvents.filter((_, i) => i % Math.ceil(sortedEvents.length / 100) === 0)
    : sortedEvents;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-2">
          📅 Fraud Transaction Timeline
        </h3>
        <p className="text-sm text-gray-500">
          Temporal sequence of {sortedEvents.length} fraudulent transactions from{' '}
          {startTime.toLocaleString()} to {endTime.toLocaleString()}
        </p>
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {/* Timeline bar */}
        <div className="h-2 bg-gray-800 rounded-full relative overflow-hidden mb-8">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Event markers */}
        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
          {displayEvents.map((event, index) => {
            const eventTime = new Date(event.timestamp);
            const position = ((eventTime - startTime) / totalDuration) * 100;

            return (
              <motion.div
                key={event.transaction_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.01 }}
                className="flex items-start gap-4 group"
              >
                {/* Time indicator */}
                <div className="flex-shrink-0 w-32 text-xs text-gray-500">
                  {eventTime.toLocaleTimeString()}
                  <div className="text-[10px] text-gray-600">
                    {eventTime.toLocaleDateString()}
                  </div>
                </div>

                {/* Event card */}
                <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:border-red-500/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-400">
                      {event.transaction_id}
                    </span>
                    <span className="text-xs font-semibold text-green-400">
                      ${event.amount.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-400 font-mono truncate max-w-[120px]" title={event.sender}>
                      {event.sender}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className="text-orange-400 font-mono truncate max-w-[120px]" title={event.receiver}>
                      {event.receiver}
                    </span>
                  </div>
                </div>

                {/* Position marker */}
                <div className="flex-shrink-0 w-12 flex items-center justify-center">
                  <div 
                    className="w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50"
                    style={{ opacity: 0.5 + (position / 200) }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Stats footer */}
        <div className="mt-6 pt-4 border-t border-gray-800 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500">Total Transactions</div>
            <div className="text-lg font-semibold text-gray-300">{sortedEvents.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Amount</div>
            <div className="text-lg font-semibold text-green-400">
              ${sortedEvents.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Time Span</div>
            <div className="text-lg font-semibold text-gray-300">
              {Math.ceil(totalDuration / (1000 * 60 * 60))}h
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
