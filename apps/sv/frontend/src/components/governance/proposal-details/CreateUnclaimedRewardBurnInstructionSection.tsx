// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { formatDatetimeWithOffset } from '../../../utils/dateFormat';
import { DetailItem } from './DetailItem';

interface CreateUnclaimedRewardBurnInstructionSectionProps {
  amount: string;
  burnBefore: string;
}

export const CreateUnclaimedRewardBurnInstructionSection: React.FC<
  CreateUnclaimedRewardBurnInstructionSectionProps
> = props => {
  const { amount, burnBefore } = props;

  return (
    <Box
      id="proposal-details-unclaimed-reward-burn-instruction-section"
      data-testid="proposal-details-unclaimed-reward-burn-instruction-section"
      sx={{ display: 'contents' }}
    >
      <DetailItem
        label="Amount"
        value={amount}
        labelId="proposal-details-amount-label"
        valueId="proposal-details-amount-value"
      />

      <DetailItem
        label="Must Burn Before"
        value={
          <>
            <Typography
              variant="body1"
              data-testid="proposal-details-must-burn-before-value"
              gutterBottom
            >
              {formatDatetimeWithOffset(burnBefore)}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {dayjs(burnBefore).fromNow()}
            </Typography>
          </>
        }
      />
    </Box>
  );
};
