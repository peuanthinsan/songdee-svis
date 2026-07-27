import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../constants/theme';

type DataPoint = {
  label: string;
  value: number;
};

type Props = {
  data: DataPoint[];
  width: number;
  height?: number;
  color?: string;
  fillColor?: string;
  title?: string;
  suffix?: string;
  showDots?: boolean;
  showArea?: boolean;
};

const PADDING = { left: 40, right: 16, top: 16, bottom: 28 };

export function LineChart({
  data,
  width,
  height = 160,
  color = colors.accent,
  fillColor,
  title,
  suffix = '',
  showDots = true,
  showArea = true,
}: Props) {
  if (data.length === 0) return null;

  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;
  const totalH = height;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const getX = (i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const getY = (v: number) => PADDING.top + chartH - ((v - minVal) / range) * chartH;

  // Build line path
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.value).toFixed(1)}`)
    .join(' ');

  // Build area path
  const areaPath = `${linePath} L ${getX(data.length - 1).toFixed(1)} ${(PADDING.top + chartH).toFixed(1)} L ${getX(0).toFixed(1)} ${(PADDING.top + chartH).toFixed(1)} Z`;

  // Y-axis labels (3 ticks)
  const yTicks = [minVal, minVal + range / 2, maxVal];

  // X-axis labels (max 6 evenly spaced)
  const maxLabels = Math.min(6, data.length);
  const labelStep = Math.max(1, Math.floor((data.length - 1) / (maxLabels - 1)));

  return (
    <View>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={totalH}>
        <Defs>
          <LinearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.2} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <Line
            key={`grid-${i}`}
            x1={PADDING.left}
            y1={getY(tick)}
            x2={width - PADDING.right}
            y2={getY(tick)}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`y-${i}`}
            x={PADDING.left - 6}
            y={getY(tick) + 4}
            fontSize={10}
            fill={colors.textTertiary}
            textAnchor="end"
          >
            {Math.round(tick)}{suffix}
          </SvgText>
        ))}

        {/* Area fill */}
        {showArea && (
          <Path d={areaPath} fill={fillColor || `url(#grad-${color})`} />
        )}

        {/* Line */}
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {showDots && data.map((d, i) => (
          <Circle
            key={`dot-${i}`}
            cx={getX(i)}
            cy={getY(d.value)}
            r={3}
            fill={colors.white}
            stroke={color}
            strokeWidth={2}
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          return (
            <SvgText
              key={`x-${i}`}
              x={getX(i)}
              y={PADDING.top + chartH + 18}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
