import { Text } from 'ink';

interface StatusDotProps {
  readonly color: string;
  readonly filled?: boolean;
}

export function StatusDot({ color, filled }: StatusDotProps) {
  return <Text color={color}>{filled === true ? '●' : '○'}</Text>;
}
