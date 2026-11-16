import Svg, { Path, Rect } from 'react-native-svg';

const WESTPAC_RED = '#DA1710';
const RATIO = 60.7 / 149; // height / width of the viewBox

/**
 * Westpac "W" logo.
 *   <WestpacLogo />                       // 80px wide, Westpac red
 *   <WestpacLogo width={56} color="#fff" /> // white, for red backgrounds
 */
export default function WestpacLogo({ width = 80, color = WESTPAC_RED, style }) {
  return (
    <Svg
      width={width}
      height={width * RATIO}
      viewBox="0 0 149 60.7"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Westpac"
    >
      <Path
        fill={color}
        d="M52.8,54.3L38.2,8.9C36.1,2,32.6,0,27.2,0H0c2.1,0.9,3.5,6.4,3.5,6.4L16.7,52c1.5,5.7,6.3,8.7,11.6,8.7h28.8C55.1,60.4,52.8,54.3,52.8,54.3"
      />
      <Path
        fill={color}
        d="M96.2,54.3l14.6-45.4C113,2,116.5,0,121.8,0H149c-2.1,0.9-3.6,6.4-3.6,6.4L132.4,52c-1.5,5.7-6.3,8.7-11.6,8.7H91.9C94,60.4,96.2,54.3,96.2,54.3"
      />
      <Rect x={58.6} y={0.4} width={32} height={60.4} fill={color} />
    </Svg>
  );
}
