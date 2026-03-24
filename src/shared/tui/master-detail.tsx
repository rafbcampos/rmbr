import { Box } from 'ink';
import type { ReactNode } from 'react';
import { BorderedPanel } from './bordered-panel.tsx';

interface MasterDetailProps {
  readonly listPanel: ReactNode;
  readonly detailPanel: ReactNode;
  readonly listTitle: string;
  readonly detailTitle: string;
}

export function MasterDetail({
  listPanel,
  detailPanel,
  listTitle,
  detailTitle,
}: MasterDetailProps) {
  return (
    <Box>
      <BorderedPanel title={listTitle} width="60%">
        {listPanel}
      </BorderedPanel>
      <BorderedPanel title={detailTitle} width="40%">
        {detailPanel}
      </BorderedPanel>
    </Box>
  );
}
