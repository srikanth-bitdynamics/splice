// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ActionRequiringConfirmation } from '@daml.js/splice-dso-governance/lib/Splice/DsoRules';
import { dateTimeFormatISO } from '@canton-network/splice-common-frontend-utils';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useDsoInfos } from '../../contexts/SvContext';
import { useAppForm } from '../../hooks/form';
import { useProposalMutation } from '../../hooks/useProposalMutation';
import {
  CREATE_PROPOSAL_LABEL_AMOUNT,
  CREATE_PROPOSAL_LABEL_EFFECTIVE_AT,
  CREATE_PROPOSAL_LABEL_MUST_BURN_BEFORE,
  CREATE_PROPOSAL_LABEL_PROPOSAL_SUMMARY,
  CREATE_PROPOSAL_LABEL_PROPOSAL_TYPE,
  CREATE_PROPOSAL_LABEL_SUPPORTING_URL,
  CREATE_PROPOSAL_LABEL_THRESHOLD_DEADLINE,
  SUPPORTING_URL_PLACEHOLDER,
  THRESHOLD_DEADLINE_SUBTITLE,
} from '../../utils/constants';
import { createProposalActions, getInitialExpiration } from '../../utils/governance';
import type { CommonProposalFormData } from '../../utils/types';
import { EffectiveDateField } from '../form-components/EffectiveDateField';
import { ProposalSubmissionError } from '../form-components/ProposalSubmissionError';
import { ProposalSummary } from '../governance/ProposalSummary';
import { FormLayout } from './FormLayout';
import {
  validateBurnAmount,
  validateBurnBefore,
  validateBurnBeforeAndEffectiveDate,
  validateEffectiveDate,
  validateExpiration,
  validateExpiryEffectiveDate,
  validateSummary,
  validateUrl,
} from './formValidators';

interface ExtraFormField {
  amount: string;
  burnBefore: string;
}

export type CreateUnclaimedRewardBurnInstructionFormData = CommonProposalFormData & ExtraFormField;

export const CreateUnclaimedRewardBurnInstructionForm: React.FC = _ => {
  const dsoInfosQuery = useDsoInfos();
  const initialExpiration = getInitialExpiration(dsoInfosQuery.data);
  const initialEffectiveDate = dayjs(initialExpiration).add(1, 'day');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const mutation = useProposalMutation();

  const createProposalAction = createProposalActions.find(
    a => a.value === 'SRARC_CreateUnclaimedRewardBurnInstruction'
  );

  const defaultValues: CreateUnclaimedRewardBurnInstructionFormData = {
    action: createProposalAction?.name || '',
    expiryDate: initialExpiration.format(dateTimeFormatISO),
    effectiveDate: {
      type: 'custom',
      effectiveDate: initialEffectiveDate.format(dateTimeFormatISO),
    },
    url: '',
    summary: '',
    amount: '',
    burnBefore: initialEffectiveDate.add(2, 'day').format(dateTimeFormatISO),
  };

  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value: formData }) => {
      const action: ActionRequiringConfirmation = {
        tag: 'ARC_DsoRules',
        value: {
          dsoAction: {
            tag: 'SRARC_CreateUnclaimedRewardBurnInstruction',
            value: {
              amount: formData.amount,
              reason: formData.summary,
              expiresAt: dayjs(formData.burnBefore).toISOString(),
            },
          },
        },
      };

      if (!showConfirmation) {
        setShowConfirmation(true);
      } else {
        await mutation.mutateAsync({ formData, action }).catch(e => {
          console.error(`Failed to submit proposal`, e);
        });
      }
    },

    validators: {
      onChange: ({ value: formData }) => {
        const expiryError = validateExpiryEffectiveDate({
          expiration: formData.expiryDate,
          effectiveDate: formData.effectiveDate.effectiveDate,
        });

        if (expiryError) return expiryError;

        return validateBurnBeforeAndEffectiveDate({
          expiration: formData.expiryDate,
          effectiveDate: formData.effectiveDate.effectiveDate,
          burnBefore: formData.burnBefore,
        });
      },
    },
  });

  return (
    <>
      <FormLayout
        form={form}
        id="create-unclaimed-reward-burn-instruction-form"
        actionName={form.state.values.action}
        isReviewStep={showConfirmation}
      >
        {showConfirmation ? (
          <ProposalSummary
            actionName={form.state.values.action}
            url={form.state.values.url}
            summary={form.state.values.summary}
            expiryDate={form.state.values.expiryDate}
            effectiveDate={form.state.values.effectiveDate.effectiveDate}
            formType="create-unclaimed-reward-burn-instruction"
            amount={form.state.values.amount}
            expiresAt={form.state.values.burnBefore}
            onEdit={() => setShowConfirmation(false)}
            onSubmit={() => {}}
          />
        ) : (
          <>
            <form.AppField name="action">
              {field => (
                <field.ProposalTypeField
                  id="create-unclaimed-reward-burn-instruction-action"
                  title={CREATE_PROPOSAL_LABEL_PROPOSAL_TYPE}
                />
              )}
            </form.AppField>

            <form.AppField
              name="amount"
              validators={{
                onBlur: ({ value }) => validateBurnAmount(value),
                onChange: ({ value }) => validateBurnAmount(value),
              }}
            >
              {field => (
                <field.TextField
                  title={CREATE_PROPOSAL_LABEL_AMOUNT}
                  id="create-unclaimed-reward-burn-instruction-amount"
                />
              )}
            </form.AppField>

            <form.AppField
              name="burnBefore"
              validators={{
                onChange: ({ value }) => validateBurnBefore(value),
                onBlur: ({ value }) => validateBurnBefore(value),
              }}
            >
              {field => (
                <field.DateField
                  title={CREATE_PROPOSAL_LABEL_MUST_BURN_BEFORE}
                  id="create-unclaimed-reward-burn-instruction-burn-before"
                />
              )}
            </form.AppField>

            <form.AppField
              name="expiryDate"
              validators={{
                onChange: ({ value }) => validateExpiration(value),
                onBlur: ({ value }) => validateExpiration(value),
              }}
            >
              {field => (
                <field.DateField
                  title={CREATE_PROPOSAL_LABEL_THRESHOLD_DEADLINE}
                  description={THRESHOLD_DEADLINE_SUBTITLE}
                  id="create-unclaimed-reward-burn-instruction-expiry-date"
                />
              )}
            </form.AppField>

            <form.AppField
              name="effectiveDate"
              validators={{
                onChange: ({ value }) => validateEffectiveDate(value),
                onBlur: ({ value }) => validateEffectiveDate(value),
              }}
              children={_ => (
                <EffectiveDateField
                  title={CREATE_PROPOSAL_LABEL_EFFECTIVE_AT}
                  initialEffectiveDate={initialEffectiveDate.format(dateTimeFormatISO)}
                  id="create-unclaimed-reward-burn-instruction-effective-date"
                />
              )}
            />

            <form.AppField
              name="summary"
              validators={{
                onBlur: ({ value }) => validateSummary(value),
                onChange: ({ value }) => validateSummary(value),
              }}
            >
              {field => (
                <field.ProposalSummaryField
                  id="create-unclaimed-reward-burn-instruction-summary"
                  title={CREATE_PROPOSAL_LABEL_PROPOSAL_SUMMARY}
                />
              )}
            </form.AppField>

            <form.AppField
              name="url"
              validators={{
                onBlur: ({ value }) => validateUrl(value),
                onChange: ({ value }) => validateUrl(value),
              }}
            >
              {field => (
                <field.TextField
                  title={CREATE_PROPOSAL_LABEL_SUPPORTING_URL}
                  id="create-unclaimed-reward-burn-instruction-url"
                  muiTextFieldProps={{ placeholder: SUPPORTING_URL_PLACEHOLDER }}
                />
              )}
            </form.AppField>
          </>
        )}

        <form.AppForm>
          <ProposalSubmissionError error={mutation.error} />

          <form.FormErrors />

          <form.FormControls
            showConfirmation={showConfirmation}
            onEdit={() => setShowConfirmation(false)}
          />
        </form.AppForm>
      </FormLayout>
    </>
  );
};
