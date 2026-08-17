import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Ellipse,
  G,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';
import type { InspectionZone, VehicleType } from '../lib/types';

type ZoneStatus = 'pending' | 'pass' | 'fail';

type Props = {
  vehicleType: VehicleType;
  zoneStatuses: Record<InspectionZone, ZoneStatus>;
  zoneFailCounts: Record<InspectionZone, number>;
  zoneItemCounts: Record<InspectionZone, number>;
  totalItemCount: number;
  activeZone: InspectionZone | null;
  onZonePress: (zone: InspectionZone) => void;
  onAllZonesPress: () => void;
  zoneLabels: Record<InspectionZone, string>;
  allZonesLabel: string;
  title: string;
  // Optional external control — if provided, overrides internal toggle state
  diagramVisible?: boolean;
  onToggleDiagram?: () => void;
};

type DiagramProps = Pick<Props, 'zoneStatuses' | 'activeZone' | 'onZonePress'>;

const ZONE_FILL: Record<ZoneStatus, string> = {
  pending: '#E0E0E0',
  pass: '#C8E6C9',
  fail: '#FFCDD2',
};

const ZONE_STROKE: Record<ZoneStatus, string> = {
  pending: '#9E9E9E',
  pass: '#388E3C',
  fail: '#D32F2F',
};

const ZONE_ICON_COLOR: Record<ZoneStatus, string> = {
  pending: '#9E9E9E',
  pass: '#2E7D32',
  fail: '#C62828',
};

const ZONES: InspectionZone[] = ['front', 'cabin', 'cargo_supplies', 'exterior_tires'];

// ---------------------------------------------------------------------------
// Car / Pickup — Top View (300 x 160)
// Based on the DHL pickup truck with cargo box from the PowerPoint reference
// ---------------------------------------------------------------------------
function CarTopView({ zoneStatuses, activeZone, onZonePress }: DiagramProps) {
  const W = 300;
  const H = 160;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Vehicle body outline */}
      <Rect x={30} y={10} width={240} height={140} rx={16} fill="#FFF9C4" stroke="#F9A825" strokeWidth={1.5} />

      {/* Front zone — engine/hood area */}
      <G onPress={() => onZonePress('front')}>
        <Path
          d="M30,26 Q30,10 46,10 L100,10 L100,150 L46,150 Q30,150 30,134 Z"
          fill={ZONE_FILL[zoneStatuses.front]}
          stroke={activeZone === 'front' ? colors.accent : ZONE_STROKE[zoneStatuses.front]}
          strokeWidth={activeZone === 'front' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Headlights */}
        <Ellipse cx={42} cy={38} rx={6} ry={10} fill="#FFF176" stroke="#F9A825" strokeWidth={1} />
        <Ellipse cx={42} cy={122} rx={6} ry={10} fill="#FFF176" stroke="#F9A825" strokeWidth={1} />
        {/* Grille lines */}
        <Line x1={35} y1={65} x2={35} y2={95} stroke="#BDBDBD" strokeWidth={1} />
        <Line x1={40} y1={60} x2={40} y2={100} stroke="#BDBDBD" strokeWidth={1} />
        {/* Engine block hint */}
        <Rect x={55} y={55} width={35} height={50} rx={4} fill="none" stroke="#BDBDBD" strokeWidth={0.8} strokeDasharray="4,3" />
        {/* Fail X mark */}
        {zoneStatuses.front === 'fail' && (
          <>
            <Line x1={50} y1={62} x2={82} y2={98} stroke="#D32F2F" strokeWidth={3} />
            <Line x1={82} y1={62} x2={50} y2={98} stroke="#D32F2F" strokeWidth={3} />
          </>
        )}
      </G>

      {/* Cabin zone — driver area */}
      <G onPress={() => onZonePress('cabin')}>
        <Rect
          x={100}
          y={10}
          width={75}
          height={140}
          fill={ZONE_FILL[zoneStatuses.cabin]}
          stroke={activeZone === 'cabin' ? colors.accent : ZONE_STROKE[zoneStatuses.cabin]}
          strokeWidth={activeZone === 'cabin' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Windshield */}
        <Rect x={102} y={25} width={71} height={110} rx={8} fill="rgba(144,202,249,0.4)" stroke="#64B5F6" strokeWidth={1} />
        {/* Steering wheel */}
        <Circle cx={125} cy={80} r={12} fill="none" stroke="#616161" strokeWidth={1.5} />
        <Circle cx={125} cy={80} r={3} fill="#616161" />
        {/* Seats */}
        <Rect x={115} y={55} width={20} height={12} rx={3} fill="none" stroke="#9E9E9E" strokeWidth={0.8} />
        <Rect x={115} y={93} width={20} height={12} rx={3} fill="none" stroke="#9E9E9E" strokeWidth={0.8} />
        {/* Dashboard */}
        <Rect x={104} y={35} width={68} height={8} rx={2} fill="rgba(97,97,97,0.15)" />
        {/* Side mirrors */}
        <Ellipse cx={100} cy={50} rx={5} ry={3} fill="#B0BEC5" stroke="#78909C" strokeWidth={0.8} />
        <Ellipse cx={100} cy={110} rx={5} ry={3} fill="#B0BEC5" stroke="#78909C" strokeWidth={0.8} />
        {/* Fail X mark */}
        {zoneStatuses.cabin === 'fail' && (
          <>
            <Line x1={112} y1={55} x2={160} y2={105} stroke="#D32F2F" strokeWidth={3} />
            <Line x1={160} y1={55} x2={112} y2={105} stroke="#D32F2F" strokeWidth={3} />
          </>
        )}
      </G>

      {/* Cargo & Supplies zone — cargo box */}
      <G onPress={() => onZonePress('cargo_supplies')}>
        <Path
          d="M175,10 L254,10 Q270,10 270,26 L270,134 Q270,150 254,150 L175,150 Z"
          fill={ZONE_FILL[zoneStatuses.cargo_supplies]}
          stroke={activeZone === 'cargo_supplies' ? colors.accent : ZONE_STROKE[zoneStatuses.cargo_supplies]}
          strokeWidth={activeZone === 'cargo_supplies' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Cargo box interior lines */}
        <Rect x={185} y={22} width={75} height={116} rx={4} fill="none" stroke="#BDBDBD" strokeWidth={0.8} />
        {/* Box grid hints */}
        <Line x1={185} y1={60} x2={260} y2={60} stroke="#E0E0E0" strokeWidth={0.6} />
        <Line x1={185} y1={100} x2={260} y2={100} stroke="#E0E0E0" strokeWidth={0.6} />
        <Line x1={222} y1={22} x2={222} y2={138} stroke="#E0E0E0" strokeWidth={0.6} />
        {/* Cargo door handle */}
        <Rect x={265} y={70} width={3} height={20} rx={1.5} fill="#9E9E9E" />
        {/* Rear lights */}
        <Rect x={268} y={25} width={4} height={12} rx={2} fill="#EF5350" />
        <Rect x={268} y={123} width={4} height={12} rx={2} fill="#EF5350" />
        {/* Fail X mark */}
        {zoneStatuses.cargo_supplies === 'fail' && (
          <>
            <Line x1={190} y1={45} x2={255} y2={115} stroke="#D32F2F" strokeWidth={3} />
            <Line x1={255} y1={45} x2={190} y2={115} stroke="#D32F2F" strokeWidth={3} />
          </>
        )}
      </G>

      {/* Exterior/Tires zone — perimeter overlay */}
      <G onPress={() => onZonePress('exterior_tires')}>
        {/* Tires — front-top (sticks out above body) */}
        <Rect x={50} y={0} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tires — front-bottom (sticks out below body) */}
        <Rect x={50} y={146} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tires — rear-top (sticks out above body) */}
        <Rect x={222} y={0} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tires — rear-bottom (sticks out below body) */}
        <Rect x={222} y={146} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tire tread lines (vertical, top-down view) */}
        {[0, 146].map(ty => [50, 222].map(tx => (
          <G key={`${tx}-${ty}`}>
            <Line x1={tx + 7} y1={ty + 3} x2={tx + 7} y2={ty + 11} stroke="#757575" strokeWidth={0.5} />
            <Line x1={tx + 14} y1={ty + 3} x2={tx + 14} y2={ty + 11} stroke="#757575" strokeWidth={0.5} />
            <Line x1={tx + 21} y1={ty + 3} x2={tx + 21} y2={ty + 11} stroke="#757575" strokeWidth={0.5} />
          </G>
        )))}
      </G>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// E-Van — Top View (300 x 160)
// ---------------------------------------------------------------------------
function EVanTopView({ zoneStatuses, activeZone, onZonePress }: DiagramProps) {
  const W = 300;
  const H = 160;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Van body — more rounded, wider */}
      <Rect x={25} y={10} width={250} height={140} rx={20} fill="#FFF9C4" stroke="#F9A825" strokeWidth={1.5} />

      {/* Front zone */}
      <G onPress={() => onZonePress('front')}>
        <Path
          d="M25,30 Q25,10 45,10 L95,10 L95,150 L45,150 Q25,150 25,130 Z"
          fill={ZONE_FILL[zoneStatuses.front]}
          stroke={activeZone === 'front' ? colors.accent : ZONE_STROKE[zoneStatuses.front]}
          strokeWidth={activeZone === 'front' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Headlights — rounded van style */}
        <Rect x={30} y={25} width={10} height={18} rx={5} fill="#FFF176" stroke="#F9A825" strokeWidth={1} />
        <Rect x={30} y={117} width={10} height={18} rx={5} fill="#FFF176" stroke="#F9A825" strokeWidth={1} />
        {/* Bumper */}
        <Path d="M28,45 Q26,80 28,115" fill="none" stroke="#BDBDBD" strokeWidth={1.5} />
        {/* Engine area */}
        <Rect x={48} y={50} width={38} height={60} rx={6} fill="none" stroke="#BDBDBD" strokeWidth={0.8} strokeDasharray="4,3" />
        {zoneStatuses.front === 'fail' && (
          <>
            <Line x1={42} y1={55} x2={82} y2={105} stroke="#D32F2F" strokeWidth={3} />
            <Line x1={82} y1={55} x2={42} y2={105} stroke="#D32F2F" strokeWidth={3} />
          </>
        )}
      </G>

      {/* Cabin zone */}
      <G onPress={() => onZonePress('cabin')}>
        <Rect
          x={95}
          y={10}
          width={70}
          height={140}
          fill={ZONE_FILL[zoneStatuses.cabin]}
          stroke={activeZone === 'cabin' ? colors.accent : ZONE_STROKE[zoneStatuses.cabin]}
          strokeWidth={activeZone === 'cabin' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Windshield — wider van style */}
        <Rect x={97} y={20} width={66} height={120} rx={10} fill="rgba(144,202,249,0.4)" stroke="#64B5F6" strokeWidth={1} />
        {/* Steering wheel */}
        <Circle cx={118} cy={80} r={12} fill="none" stroke="#616161" strokeWidth={1.5} />
        <Circle cx={118} cy={80} r={3} fill="#616161" />
        {/* Driver + passenger seats */}
        <Rect x={108} y={55} width={20} height={12} rx={3} fill="none" stroke="#9E9E9E" strokeWidth={0.8} />
        <Rect x={108} y={93} width={20} height={12} rx={3} fill="none" stroke="#9E9E9E" strokeWidth={0.8} />
        {/* Dashboard */}
        <Rect x={99} y={30} width={62} height={8} rx={2} fill="rgba(97,97,97,0.15)" />
        {/* Side mirrors */}
        <Ellipse cx={95} cy={45} rx={6} ry={4} fill="#B0BEC5" stroke="#78909C" strokeWidth={0.8} />
        <Ellipse cx={95} cy={115} rx={6} ry={4} fill="#B0BEC5" stroke="#78909C" strokeWidth={0.8} />
        {zoneStatuses.cabin === 'fail' && (
          <>
            <Line x1={105} y1={50} x2={155} y2={110} stroke="#D32F2F" strokeWidth={3} />
            <Line x1={155} y1={50} x2={105} y2={110} stroke="#D32F2F" strokeWidth={3} />
          </>
        )}
      </G>

      {/* Cargo & Supplies zone — van cargo area */}
      <G onPress={() => onZonePress('cargo_supplies')}>
        <Path
          d="M165,10 L255,10 Q275,10 275,30 L275,130 Q275,150 255,150 L165,150 Z"
          fill={ZONE_FILL[zoneStatuses.cargo_supplies]}
          stroke={activeZone === 'cargo_supplies' ? colors.accent : ZONE_STROKE[zoneStatuses.cargo_supplies]}
          strokeWidth={activeZone === 'cargo_supplies' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Interior lines */}
        <Rect x={175} y={22} width={85} height={116} rx={4} fill="none" stroke="#BDBDBD" strokeWidth={0.8} />
        <Line x1={175} y1={60} x2={260} y2={60} stroke="#E0E0E0" strokeWidth={0.6} />
        <Line x1={175} y1={100} x2={260} y2={100} stroke="#E0E0E0" strokeWidth={0.6} />
        <Line x1={217} y1={22} x2={217} y2={138} stroke="#E0E0E0" strokeWidth={0.6} />
        {/* Rear door handles */}
        <Rect x={270} y={65} width={3} height={15} rx={1.5} fill="#9E9E9E" />
        <Rect x={270} y={80} width={3} height={15} rx={1.5} fill="#9E9E9E" />
        {/* Rear lights */}
        <Rect x={272} y={22} width={4} height={14} rx={2} fill="#EF5350" />
        <Rect x={272} y={124} width={4} height={14} rx={2} fill="#EF5350" />
        {zoneStatuses.cargo_supplies === 'fail' && (
          <>
            <Line x1={180} y1={40} x2={255} y2={120} stroke="#D32F2F" strokeWidth={3} />
            <Line x1={255} y1={40} x2={180} y2={120} stroke="#D32F2F" strokeWidth={3} />
          </>
        )}
      </G>

      {/* Exterior/Tires zone */}
      <G onPress={() => onZonePress('exterior_tires')}>
        {/* Tires — front-top (sticks out above body) */}
        <Rect x={45} y={0} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tires — front-bottom (sticks out below body) */}
        <Rect x={45} y={146} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tires — rear-top (sticks out above body) */}
        <Rect x={227} y={0} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tires — rear-bottom (sticks out below body) */}
        <Rect x={227} y={146} width={28} height={14} rx={4}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.2}
        />
        {/* Tire tread lines (vertical, top-down view) */}
        {[0, 146].map(ty => [45, 227].map(tx => (
          <G key={`${tx}-${ty}`}>
            <Line x1={tx + 7} y1={ty + 3} x2={tx + 7} y2={ty + 11} stroke="#757575" strokeWidth={0.5} />
            <Line x1={tx + 14} y1={ty + 3} x2={tx + 14} y2={ty + 11} stroke="#757575" strokeWidth={0.5} />
            <Line x1={tx + 21} y1={ty + 3} x2={tx + 21} y2={ty + 11} stroke="#757575" strokeWidth={0.5} />
          </G>
        )))}
      </G>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Motorcycle — Top View (200 x 160)
// ---------------------------------------------------------------------------
function MotorcycleTopView({ zoneStatuses, activeZone, onZonePress }: DiagramProps) {
  const W = 200;
  const H = 160;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Body frame center line */}
      <Line x1={20} y1={80} x2={180} y2={80} stroke="#BDBDBD" strokeWidth={2} />

      {/* Front zone — headlight & handlebars */}
      <G onPress={() => onZonePress('front')}>
        <Ellipse
          cx={35}
          cy={80}
          rx={30}
          ry={45}
          fill={ZONE_FILL[zoneStatuses.front]}
          stroke={activeZone === 'front' ? colors.accent : ZONE_STROKE[zoneStatuses.front]}
          strokeWidth={activeZone === 'front' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Front wheel */}
        <Ellipse cx={18} cy={80} rx={8} ry={22} fill="none" stroke="#616161" strokeWidth={2} />
        <Line x1={18} y1={58} x2={18} y2={102} stroke="#757575" strokeWidth={0.8} />
        {/* Headlight */}
        <Circle cx={12} cy={80} r={5} fill="#FFF176" stroke="#F9A825" strokeWidth={1} />
        {/* Handlebars */}
        <Line x1={28} y1={50} x2={28} y2={42} stroke="#616161" strokeWidth={2.5} />
        <Line x1={28} y1={110} x2={28} y2={118} stroke="#616161" strokeWidth={2.5} />
        {/* Mirrors */}
        <Ellipse cx={22} cy={40} rx={5} ry={3} fill="#B0BEC5" stroke="#78909C" strokeWidth={0.8} />
        <Ellipse cx={22} cy={120} rx={5} ry={3} fill="#B0BEC5" stroke="#78909C" strokeWidth={0.8} />
        {zoneStatuses.front === 'fail' && (
          <>
            <Line x1={18} y1={60} x2={48} y2={100} stroke="#D32F2F" strokeWidth={2.5} />
            <Line x1={48} y1={60} x2={18} y2={100} stroke="#D32F2F" strokeWidth={2.5} />
          </>
        )}
      </G>

      {/* Cabin zone — rider seat area */}
      <G onPress={() => onZonePress('cabin')}>
        <Rect
          x={60}
          y={55}
          width={45}
          height={50}
          rx={10}
          fill={ZONE_FILL[zoneStatuses.cabin]}
          stroke={activeZone === 'cabin' ? colors.accent : ZONE_STROKE[zoneStatuses.cabin]}
          strokeWidth={activeZone === 'cabin' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Fuel tank */}
        <Ellipse cx={70} cy={80} rx={8} ry={15} fill="none" stroke="#BDBDBD" strokeWidth={0.8} />
        {/* Seat */}
        <Rect x={80} y={68} width={22} height={24} rx={6} fill="none" stroke="#9E9E9E" strokeWidth={1} />
        {/* Dashboard hint */}
        <Rect x={62} y={70} width={6} height={20} rx={2} fill="rgba(97,97,97,0.15)" />
        {zoneStatuses.cabin === 'fail' && (
          <>
            <Line x1={62} y1={58} x2={102} y2={102} stroke="#D32F2F" strokeWidth={2.5} />
            <Line x1={102} y1={58} x2={62} y2={102} stroke="#D32F2F" strokeWidth={2.5} />
          </>
        )}
      </G>

      {/* Cargo & Supplies zone — delivery box */}
      <G onPress={() => onZonePress('cargo_supplies')}>
        <Rect
          x={110}
          y={45}
          width={60}
          height={70}
          rx={6}
          fill={ZONE_FILL[zoneStatuses.cargo_supplies]}
          stroke={activeZone === 'cargo_supplies' ? colors.accent : ZONE_STROKE[zoneStatuses.cargo_supplies]}
          strokeWidth={activeZone === 'cargo_supplies' ? 2.5 : 1.5}
          opacity={0.85}
        />
        {/* Bike box interior */}
        <Rect x={115} y={50} width={50} height={60} rx={3} fill="none" stroke="#BDBDBD" strokeWidth={0.8} />
        <Line x1={115} y1={80} x2={165} y2={80} stroke="#E0E0E0" strokeWidth={0.5} />
        <Line x1={140} y1={50} x2={140} y2={110} stroke="#E0E0E0" strokeWidth={0.5} />
        {zoneStatuses.cargo_supplies === 'fail' && (
          <>
            <Line x1={118} y1={52} x2={162} y2={108} stroke="#D32F2F" strokeWidth={2.5} />
            <Line x1={162} y1={52} x2={118} y2={108} stroke="#D32F2F" strokeWidth={2.5} />
          </>
        )}
      </G>

      {/* Exterior/Tires zone — rear wheel + body */}
      <G onPress={() => onZonePress('exterior_tires')}>
        {/* Rear wheel */}
        <Ellipse cx={178} cy={80} rx={8} ry={22}
          fill={ZONE_FILL[zoneStatuses.exterior_tires]}
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 2 : 1.5}
        />
        <Line x1={178} y1={58} x2={178} y2={102} stroke="#757575" strokeWidth={0.8} />
        {/* Front wheel perimeter (shared) */}
        <Ellipse cx={18} cy={80} rx={10} ry={25}
          fill="none"
          stroke={activeZone === 'exterior_tires' ? colors.accent : ZONE_STROKE[zoneStatuses.exterior_tires]}
          strokeWidth={activeZone === 'exterior_tires' ? 1.5 : 0.8}
          strokeDasharray="4,3"
        />
        {/* Tail light */}
        <Rect x={184} y={74} width={6} height={12} rx={3} fill="#EF5350" />
        {/* Chain/body line */}
        <Line x1={100} y1={95} x2={178} y2={95} stroke={ZONE_STROKE[zoneStatuses.exterior_tires]} strokeWidth={0.8} strokeDasharray="4,3" />
        <Line x1={100} y1={65} x2={178} y2={65} stroke={ZONE_STROKE[zoneStatuses.exterior_tires]} strokeWidth={0.8} strokeDasharray="4,3" />
      </G>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Main VehicleMap component — wraps SVG + zone legend buttons below
// ---------------------------------------------------------------------------
export default function VehicleMap({
  vehicleType,
  zoneStatuses,
  zoneFailCounts,
  zoneItemCounts,
  totalItemCount,
  activeZone,
  onZonePress,
  onAllZonesPress,
  zoneLabels,
  allZonesLabel,
  title,
  diagramVisible: diagramVisibleProp,
  onToggleDiagram,
}: Props) {
  const [internalVisible, setInternalVisible] = useState(true);
  // Use external control if provided, otherwise fall back to internal state
  const diagramVisible = diagramVisibleProp !== undefined ? diagramVisibleProp : internalVisible;
  const handleToggle = onToggleDiagram ?? (() => setInternalVisible(v => !v));
  const svgProps = { zoneStatuses, activeZone, onZonePress };

  return (
    <View style={styles.container}>
      {/* Toggle header */}
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleLabel}>{title}</Text>
        <Ionicons
          name={diagramVisible ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* SVG illustration */}
      {diagramVisible && (
        <View style={styles.svgWrap}>
          {vehicleType === 'motorcycle' ? (
            <MotorcycleTopView {...svgProps} />
          ) : vehicleType === 'e_van' ? (
            <EVanTopView {...svgProps} />
          ) : (
            <CarTopView {...svgProps} />
          )}
        </View>
      )}

      {/* Zone buttons row */}
      <View style={styles.zoneRow}>
        <TouchableOpacity
          style={[
            styles.zoneBtn,
            activeZone === null && styles.zoneBtnActive,
          ]}
          onPress={onAllZonesPress}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeZone === null }}
        >
          <Ionicons
            name="list-outline"
            size={14}
            color={activeZone === null ? colors.accent : colors.textTertiary}
            style={{ marginBottom: 2 }}
          />
          <Text
            style={[
              styles.zoneBtnText,
              activeZone === null && styles.zoneBtnTextActive,
            ]}
            numberOfLines={2}
          >
            {allZonesLabel}
          </Text>
          <Text style={styles.zoneItemCount}>{totalItemCount}</Text>
        </TouchableOpacity>
        {ZONES.map((zone) => {
          const status = zoneStatuses[zone];
          const active = activeZone === zone;
          const failCount = zoneFailCounts[zone] || 0;
          return (
            <TouchableOpacity
              key={zone}
              style={[
                styles.zoneBtn,
                active && styles.zoneBtnActive,
                status === 'fail' && styles.zoneBtnFail,
                status === 'pass' && styles.zoneBtnPass,
              ]}
              onPress={() => onZonePress(zone)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={
                  status === 'pass'
                    ? 'checkmark-circle'
                    : status === 'fail'
                    ? 'close-circle'
                    : 'ellipse-outline'
                }
                size={14}
                color={ZONE_ICON_COLOR[status]}
                style={{ marginBottom: 2 }}
              />
              <Text
                style={[
                  styles.zoneBtnText,
                  active && styles.zoneBtnTextActive,
                ]}
                numberOfLines={2}
              >
                {zoneLabels[zone]}
              </Text>
              <Text style={styles.zoneItemCount}>{zoneItemCounts[zone]}</Text>
              {failCount > 0 && (
                <View style={styles.zoneBadge}>
                  <Text style={styles.zoneBadgeText}>{failCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  svgWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  zoneRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  zoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  zoneBtnActive: {
    borderColor: colors.accent,
    backgroundColor: '#FFF3E0',
  },
  zoneBtnFail: {
    backgroundColor: '#FFF0F0',
  },
  zoneBtnPass: {
    backgroundColor: '#F0FFF0',
  },
  zoneBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  zoneBtnTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  zoneItemCount: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  zoneBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.statusFail,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
