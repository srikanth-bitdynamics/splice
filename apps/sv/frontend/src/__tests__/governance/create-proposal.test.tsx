// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, test } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@emotion/react';
import { theme } from '../../../../../common/frontend/lib/theme';
import { CreateProposal } from '../../routes/createProposal';
import userEvent from '@testing-library/user-event';
import { Wrapper } from '../helpers';
import { createProposalActions } from '../../utils/governance';
import { http, HttpResponse } from 'msw';
import { dsoInfo } from '@canton-network/splice-common-test-handlers';
import { server, svUrl } from '../setup/setup';
import { dateTimeFormatISO } from '@canton-network/splice-common-frontend-utils';
import dayjs from 'dayjs';
import { CreateUnclaimedRewardBurnInstructionForm } from '../../components/forms/CreateUnclaimedRewardBurnInstructionForm';
import {
  CREATE_PROPOSAL_LABEL_PROPOSAL_TYPE,
  PROPOSAL_REVIEW_TITLE,
  PROPOSAL_SUMMARY_SUBTITLE,
} from '../../utils/constants';

const TestWrapper: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <MemoryRouter>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </MemoryRouter>
  );
};

async function checkActionSelection(actionName: string, actionValue: string, testId: string) {
  const user = userEvent.setup();

  render(
    <Wrapper>
      <CreateProposal />
    </Wrapper>
  );

  const actionDropdown = screen.getByTestId('select-action');

  const selectInput = actionDropdown.querySelector('[role="combobox"]') as HTMLElement;
  await user.click(selectInput);

  const actionToSelect = await screen.findByText(actionName);
  await user.click(actionToSelect);

  const nextButton = screen.getByText('Next');
  expect(nextButton).toBeInTheDocument();
  await user.click(nextButton);

  const actionInput = await screen.findByTestId(testId);
  const action = createProposalActions.find(a => a.value === actionValue);
  expect(actionInput.textContent).toBe(action!.name);
}

// The SV app's /v1/dso endpoint requires authentication, so log in before rendering
// (matches the UserProvider's session-restore path for test auth).
beforeAll(() => {
  window.sessionStorage.setItem('canton.network.wallet.userid', 'sv1');
});

describe('Create Proposal', () => {
  test('Does not render the form while dsoInfo is pending, then lands on +7d default', async () => {
    let releaseDso!: () => void;
    const dsoReady = new Promise<void>(resolve => {
      releaseDso = resolve;
    });

    server.use(
      http.get(`${svUrl}/v1/dso`, async () => {
        await dsoReady;
        return HttpResponse.json(dsoInfo);
      })
    );

    render(
      <Wrapper initialEntries={['/?action=SRARC_OffboardSv']}>
        <CreateProposal />
      </Wrapper>
    );

    await screen.findByTestId('loading-spinner');
    expect(screen.queryByTestId('offboard-sv-expiry-date-field')).not.toBeInTheDocument();

    releaseDso();

    const expiryDateInput = await screen.findByTestId('offboard-sv-expiry-date-field');
    const expectedExpiry = dayjs().add(7, 'days');
    const actualExpiry = dayjs(expiryDateInput.getAttribute('value')!, dateTimeFormatISO);
    expect(Math.abs(actualExpiry.diff(expectedExpiry, 'minute'))).toBeLessThan(2);
  });

  test('Display action selection and all actions', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <CreateProposal />
      </TestWrapper>
    );

    const actionDropdown = screen.getByTestId('select-action');
    expect(actionDropdown).toBeDefined();

    const selectInput = actionDropdown.querySelector('[role="combobox"]') as HTMLElement;
    user.click(selectInput);

    await waitFor(() => {
      expect(screen.getByText('Offboard Member')).toBeInTheDocument();
      expect(screen.getByText('Feature Application')).toBeInTheDocument();
      expect(screen.getByText('Unfeature Application')).toBeInTheDocument();
      expect(
        screen.getByText('Set Decentralized Synchronizer Operations (DSO) Rules Configuration')
      ).toBeInTheDocument();
      expect(screen.getByText('Set Amulet Rules Configuration')).toBeInTheDocument();
      expect(screen.getByText('Update Super Validator Reward Weight')).toBeInTheDocument();
      expect(screen.getByText('Create Unclaimed Activity Record')).toBeInTheDocument();
      expect(screen.getByText('Burn Unclaimed Rewards')).toBeInTheDocument();
    });
  });

  test('Offboard SV Form is rendered after action selection', async () => {
    await checkActionSelection('Offboard Member', 'SRARC_OffboardSv', 'offboard-sv-action');
  });

  test('Feature Application Form is rendered after action selection', async () => {
    await checkActionSelection(
      'Feature Application',
      'SRARC_GrantFeaturedAppRight',
      'grant-featured-app-action'
    );
  });

  test('Unfeature Application Form is rendered after action selection', async () => {
    await checkActionSelection(
      'Unfeature Application',
      'SRARC_RevokeFeaturedAppRight',
      'revoke-featured-app-action'
    );
  });

  test('Set Decentralized Synchronizer Operations (DSO) Rules Configuration Form is rendered after action selection', async () => {
    await checkActionSelection(
      'Set Decentralized Synchronizer Operations (DSO) Rules Configuration',
      'SRARC_SetConfig',
      'set-dso-config-rules-action'
    );
  });

  test('Set Amulet Rules Configuration Form is rendered after action selection', async () => {
    await checkActionSelection(
      'Set Amulet Rules Configuration',
      'CRARC_SetConfig',
      'set-amulet-config-rules-action'
    );
  });

  test('Update Super Validator Reward Weight Form is rendered after action selection', async () => {
    await checkActionSelection(
      'Update Super Validator Reward Weight',
      'SRARC_UpdateSvRewardWeight',
      'update-sv-reward-weight-action'
    );
  });

  test('Create Unclaimed Activity Record Form is rendered after action selection', async () => {
    await checkActionSelection(
      'Create Unclaimed Activity Record',
      'SRARC_CreateUnallocatedUnclaimedActivityRecord',
      'create-unallocated-unclaimed-activity-record-action'
    );
  });

  test('Burn Unclaimed Rewards Form is rendered after action selection', async () => {
    await checkActionSelection(
      'Burn Unclaimed Rewards',
      'SRARC_CreateUnclaimedRewardBurnInstruction',
      'create-unclaimed-reward-burn-instruction-action'
    );
  });

  test('Display cancel and next buttons', () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <CreateProposal />
        </ThemeProvider>
      </MemoryRouter>
    );

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDefined();

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDefined();
  });

  test('Next button is disabled on initial render but enabled after action selection', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <CreateProposal />
        </ThemeProvider>
      </MemoryRouter>
    );

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDefined();
    expect(nextButton.getAttribute('disabled')).not.toBeNull();

    const actionDropdown = screen.getByTestId('select-action');
    expect(actionDropdown).toBeDefined();

    const selectInput = actionDropdown.querySelector('[role="combobox"]') as HTMLElement;
    await user.click(selectInput);

    const actionToSelect = await screen.findByText('Offboard Member');
    await user.click(actionToSelect);

    await waitFor(() => {
      expect(nextButton.getAttribute('disabled')).toBeNull();
    });
  });
});

describe('Create Unclaimed Reward Burn Instruction Form', () => {
  const fillOutBurnForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(
      screen.getByTestId('create-unclaimed-reward-burn-instruction-summary'),
      'Summary of the proposal'
    );
    await user.type(
      screen.getByTestId('create-unclaimed-reward-burn-instruction-url'),
      'https://example.com'
    );
    await user.type(screen.getByTestId('create-unclaimed-reward-burn-instruction-amount'), '100');
  };

  test('should render all Create Unclaimed Reward Burn Instruction Form components', () => {
    render(
      <Wrapper>
        <CreateUnclaimedRewardBurnInstructionForm />
      </Wrapper>
    );

    expect(screen.getByTestId('create-unclaimed-reward-burn-instruction-form')).toBeInTheDocument();
    expect(screen.getByText(CREATE_PROPOSAL_LABEL_PROPOSAL_TYPE)).toBeInTheDocument();

    const actionInput = screen.getByTestId('create-unclaimed-reward-burn-instruction-action');
    expect(actionInput).toBeInTheDocument();
    expect(actionInput.textContent).toBe('Burn Unclaimed Rewards');

    const summaryInput = screen.getByTestId('create-unclaimed-reward-burn-instruction-summary');
    expect(summaryInput).toBeInTheDocument();
    expect(summaryInput.getAttribute('value')).toBeNull();

    const summarySubtitle = screen.getByTestId(
      'create-unclaimed-reward-burn-instruction-summary-subtitle'
    );
    expect(summarySubtitle).toBeInTheDocument();
    expect(summarySubtitle.textContent).toBe(PROPOSAL_SUMMARY_SUBTITLE);

    const urlInput = screen.getByTestId('create-unclaimed-reward-burn-instruction-url');
    expect(urlInput).toBeInTheDocument();
    expect(urlInput.getAttribute('value')).toBe('');

    const amountInput = screen.getByTestId('create-unclaimed-reward-burn-instruction-amount');
    expect(amountInput).toBeInTheDocument();
    expect(amountInput.getAttribute('value')).toBe('');

    const burnBeforeInput = screen.getByTestId(
      'create-unclaimed-reward-burn-instruction-burn-before-field'
    );
    expect(burnBeforeInput).toBeInTheDocument();

    expect(screen.getByText('Review Proposal')).toBeInTheDocument();
  });

  test('should render errors when submit button is clicked on new form', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateUnclaimedRewardBurnInstructionForm />
      </Wrapper>
    );

    const actionInput = screen.getByTestId('create-unclaimed-reward-burn-instruction-action');
    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeInTheDocument();

    await user.click(submitButton);
    expect(submitButton.getAttribute('disabled')).not.toBeNull();
    await expect(async () => await user.click(submitButton)).rejects.toThrowError(
      /Unable to perform pointer interaction/
    );

    screen.getByText('Summary is required');
    screen.getByText('Invalid URL');

    expect(
      screen.getByTestId('create-unclaimed-reward-burn-instruction-amount-error').textContent
    ).toBe('Amount is required');

    // completing the form should reenable the submit button
    await fillOutBurnForm(user);

    await user.click(actionInput); // using this to trigger the onBlur event which triggers the validation

    expect(submitButton.getAttribute('disabled')).toBeNull();
  });

  test('rejects a zero burn amount', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <CreateUnclaimedRewardBurnInstructionForm />
      </Wrapper>
    );

    await fillOutBurnForm(user);
    const amountInput = screen.getByTestId('create-unclaimed-reward-burn-instruction-amount');
    await user.clear(amountInput);
    await user.type(amountInput, '0');

    expect(await screen.findByText('Amount must be greater than zero')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  test('burn before date must be at least 2 hours after effective date', async () => {
    render(
      <Wrapper>
        <CreateUnclaimedRewardBurnInstructionForm />
      </Wrapper>
    );

    const expiryDateInput = screen.getByTestId(
      'create-unclaimed-reward-burn-instruction-expiry-date-field'
    );
    const effectiveDateInput = screen.getByTestId(
      'create-unclaimed-reward-burn-instruction-effective-date-field'
    );
    const burnBeforeInput = screen.getByTestId(
      'create-unclaimed-reward-burn-instruction-burn-before-field'
    );
    const errorMessage = 'Burn Before date must be at least 2 hours after Effective Date';

    fireEvent.change(expiryDateInput, {
      target: { value: dayjs().add(10, 'days').format(dateTimeFormatISO) },
    });

    const effectiveDate = dayjs().add(14, 'days').format(dateTimeFormatISO);
    fireEvent.change(effectiveDateInput, { target: { value: effectiveDate } });

    fireEvent.change(burnBeforeInput, {
      target: { value: dayjs().add(16, 'days').format(dateTimeFormatISO) },
    });

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    });

    fireEvent.change(burnBeforeInput, {
      target: { value: dayjs(effectiveDate).subtract(1, 'day').format(dateTimeFormatISO) },
    });

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).toBeInTheDocument();
    });

    fireEvent.change(burnBeforeInput, {
      target: { value: dayjs(effectiveDate).add(1, 'hour').format(dateTimeFormatISO) },
    });

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('burn before date must be at least 2 hours after expiry date when effective at threshold', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateUnclaimedRewardBurnInstructionForm />
      </Wrapper>
    );

    const expiryDateInput = screen.getByTestId(
      'create-unclaimed-reward-burn-instruction-expiry-date-field'
    );
    const burnBeforeInput = screen.getByTestId(
      'create-unclaimed-reward-burn-instruction-burn-before-field'
    );
    const errorMessage =
      'Burn Before date must be at least 2 hours after Quorum Threshold Deadline';

    await user.click(screen.getByTestId('effective-at-threshold-radio'));

    const expiryDate = dayjs().add(10, 'days');
    fireEvent.change(expiryDateInput, {
      target: { value: expiryDate.format(dateTimeFormatISO) },
    });

    fireEvent.change(burnBeforeInput, {
      target: { value: expiryDate.subtract(1, 'day').format(dateTimeFormatISO) },
    });

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).toBeInTheDocument();
    });

    fireEvent.change(burnBeforeInput, {
      target: { value: expiryDate.add(1, 'hour').format(dateTimeFormatISO) },
    });

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).toBeInTheDocument();
    });

    fireEvent.change(burnBeforeInput, {
      target: { value: expiryDate.add(3, 'hours').format(dateTimeFormatISO) },
    });

    await waitFor(() => {
      expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    });
  });

  test('should show error on form if submission fails', async () => {
    server.use(
      http.post(`${svUrl}/v0/admin/sv/voterequest/create`, () => {
        return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
      })
    );

    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateUnclaimedRewardBurnInstructionForm />
      </Wrapper>
    );

    const submitButton = screen.getByTestId('submit-button');

    await fillOutBurnForm(user);

    await waitFor(async () => {
      expect(submitButton.getAttribute('disabled')).toBeNull();
    });

    await user.click(submitButton); //review proposal
    await user.click(submitButton); //submit proposal

    expect(screen.getByTestId('proposal-submission-error')).toBeInTheDocument();
    expect(screen.getByText(/Submission failed/)).toBeInTheDocument();
    expect(screen.getByText(/Service Unavailable/)).toBeInTheDocument();
  });

  test('reviews and sends the burn action with the burn before date in UTC', async () => {
    let requestBody = '';
    server.use(
      http.post(`${svUrl}/v0/admin/sv/voterequest/create`, async ({ request }) => {
        requestBody = await request.text();
        return HttpResponse.json({});
      })
    );

    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateUnclaimedRewardBurnInstructionForm />
      </Wrapper>
    );

    const actionInput = screen.getByTestId('create-unclaimed-reward-burn-instruction-action');
    const submitButton = screen.getByTestId('submit-button');

    await fillOutBurnForm(user);

    const burnBeforeLocal = dayjs().add(14, 'days').startOf('hour');
    fireEvent.change(
      screen.getByTestId('create-unclaimed-reward-burn-instruction-burn-before-field'),
      { target: { value: burnBeforeLocal.format(dateTimeFormatISO) } }
    );

    await user.click(actionInput);

    await waitFor(async () => {
      expect(submitButton.getAttribute('disabled')).toBeNull();
    });

    await user.click(submitButton);
    expect(screen.getByText(PROPOSAL_REVIEW_TITLE)).toBeInTheDocument();
    expect(screen.getByText('Must Burn Before')).toBeInTheDocument();

    await user.click(submitButton);

    await screen.findByText('Successfully submitted the proposal');

    expect(requestBody).toContain('"tag":"SRARC_CreateUnclaimedRewardBurnInstruction"');
    expect(requestBody).toContain('"amount":"100"');
    expect(requestBody).toContain('"reason":"Summary of the proposal"');
    const expectedUtc = burnBeforeLocal.toISOString();
    const naiveLocalAsUtc = `${burnBeforeLocal.format('YYYY-MM-DDTHH:mm:ss')}.000Z`;
    expect(expectedUtc).not.toBe(naiveLocalAsUtc);
    expect(requestBody).toContain(`"expiresAt":"${expectedUtc}"`);
    expect(requestBody).not.toContain(naiveLocalAsUtc);
  });
});
