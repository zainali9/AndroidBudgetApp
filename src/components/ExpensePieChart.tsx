import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Budget, pieSlices, pkr, spendingTotal } from '../sampleData';
import { Label } from './Common';

export function ExpensePieChart({ budgets }: { budgets: Budget[] }) {
  const slices = pieSlices(budgets);
  const total = spendingTotal(budgets);
  if (!slices.length) return <Label muted>No expenses to chart this month.</Label>;
  return <View style={{ gap: 10 }}>
    <View accessible accessibilityLabel={`Monthly expense pie chart. Total ${pkr(total)}. Category amounts listed below.`} style={{ alignItems: 'center' }}>
      <Svg width={150} height={150} viewBox="0 0 160 160" accessible={false}>
        {slices.map(slice => {
          if (slice.sweep >= 359.999) return <Circle key={slice.name} cx={80} cy={80} r={78} fill={slice.color} />;
          const radians = Math.PI / 180;
          const x1 = 80 + 78 * Math.cos(slice.start * radians);
          const y1 = 80 + 78 * Math.sin(slice.start * radians);
          const x2 = 80 + 78 * Math.cos((slice.start + slice.sweep) * radians);
          const y2 = 80 + 78 * Math.sin((slice.start + slice.sweep) * radians);
          return <Path key={slice.name} fill={slice.color} d={`M80 80 L${x1} ${y1} A78 78 0 ${slice.sweep > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} />;
        })}
      </Svg>
    </View>
    {slices.map(slice => <View key={slice.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: slice.color }} />
      <Label style={{ flex: 1 }}>{slice.name}</Label>
      <Label muted style={{ fontSize: 12, flexShrink: 1 }}>{pkr(slice.spent)} · {(slice.spent / total * 100).toFixed(1)}%</Label>
    </View>)}
  </View>;
}
