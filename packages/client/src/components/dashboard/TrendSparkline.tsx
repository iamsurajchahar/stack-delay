import { useScoreHistory } from '../../hooks/useScores';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getScoreRingColor } from '../../utils/scoreColors';

interface TrendSparklineProps {
  repoId: string;
  data?: Array<{ date: string; score: number }>;
  width?: number;
  height?: number;
}

export function TrendSparkline({ repoId, data: providedData, width = 80, height = 32 }: TrendSparklineProps) {
  const { data: history } = useScoreHistory(repoId);

  const chartData = providedData || (history || []).slice(-15).map((s) => ({
    date: String(s.snapshotDate),
    score: s.compositeScore,
  }));

  if (chartData.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-gray-300">--</div>;
  }

  const latestScore = chartData[chartData.length - 1]?.score ?? 50;
  const color = getScoreRingColor(latestScore);

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
