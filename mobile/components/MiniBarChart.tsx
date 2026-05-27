import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Line } from "react-native-svg";
import type { MonthlyRevenue } from "@/lib/analytics";

interface Props {
  data: MonthlyRevenue[];
  height?: number;
  barColor?: string;
  accentColor?: string;
}

export function MiniBarChart({
  data,
  height = 72,
  barColor = "#6c63ff",
  accentColor = "#22c55e",
}: Props) {
  const WIDTH = 240;
  const CHART_H = height - 20; // leave space for labels below
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const barW = Math.floor(WIDTH / data.length) - 4;

  return (
    <View style={styles.wrapper}>
      <Svg width={WIDTH} height={height}>
        {/* Baseline */}
        <Line
          x1={0}
          y1={CHART_H}
          x2={WIDTH}
          y2={CHART_H}
          stroke="#1e2029"
          strokeWidth={1}
        />
        {data.map((item, i) => {
          const barH = Math.max(2, (item.total / maxVal) * CHART_H);
          const x = i * (barW + 4);
          const y = CHART_H - barH;
          const isLast = i === data.length - 1;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              fill={isLast ? accentColor : barColor}
              opacity={isLast ? 1 : 0.55}
            />
          );
        })}
      </Svg>
      {/* Month labels */}
      <View style={[styles.labels, { width: WIDTH }]}>
        {data.map((item, i) => (
          <Text key={i} style={[styles.label, { width: barW + 4 }]}>
            {item.month}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "flex-start" },
  labels: { flexDirection: "row", marginTop: 2 },
  label: { fontSize: 9, color: "#6b7280", textAlign: "center" },
});
