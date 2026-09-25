// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { describe, expect, it } from 'vitest';
import {
  configValueToSwitchOverMap,
  isSwitchOverField,
  serializeSwitchOverTimes,
  switchOverConfigValueToDisplayEntries,
  switchOverEntriesToConfigValue,
  switchOverMapToConfigValue,
  validateBurnAmount,
  validateBurnBefore,
  validateExpiration,
  validateExpiryEffectiveDate,
  validateSwitchOverTimes,
  visibleSwitchOverRows,
} from '../components/forms/formValidators';

dayjs.extend(utc);

describe('validateSwitchOverTimes', () => {
  const eff = '2026-09-01T00:00:00Z';

  it('passes with no entries', () => {
    expect(validateSwitchOverTimes([], false, eff)).toBe(false);
  });

  it('rejects an empty key', () => {
    expect(
      validateSwitchOverTimes([{ key: '  ', time: '2026-09-05T00:00:00Z' }], false, eff)
    ).toBeTruthy();
  });

  it('rejects duplicate keys', () => {
    expect(
      validateSwitchOverTimes(
        [
          { key: 'a', time: '2026-09-05T00:00:00Z' },
          { key: 'a', time: '2026-09-06T00:00:00Z' },
        ],
        false,
        eff
      )
    ).toBeTruthy();
  });

  it('rejects a time less than 1 day after effectivity', () => {
    expect(
      validateSwitchOverTimes([{ key: 'a', time: '2026-09-01T12:00:00Z' }], false, eff)
    ).toBeTruthy();
  });

  it('accepts a time exactly 1 day after effectivity (inclusive)', () => {
    expect(validateSwitchOverTimes([{ key: 'a', time: '2026-09-02T00:00:00Z' }], false, eff)).toBe(
      false
    );
  });

  it('accepts a time more than 1 day after effectivity', () => {
    expect(validateSwitchOverTimes([{ key: 'a', time: '2026-09-10T00:00:00Z' }], false, eff)).toBe(
      false
    );
  });

  it('accepts a past time when non-future-dated is allowed', () => {
    expect(validateSwitchOverTimes([{ key: 'a', time: '2020-01-01T00:00:00Z' }], true, eff)).toBe(
      false
    );
  });

  it('skips the 1-day check at threshold (no effective date)', () => {
    expect(
      validateSwitchOverTimes([{ key: 'a', time: '2020-01-01T00:00:00Z' }], false, undefined)
    ).toBe(false);
  });

  it('treats a min-bound (0001-01-01) time as unset and does not error', () => {
    expect(
      validateSwitchOverTimes(
        [{ key: 'no-featured-app-choice-context', time: '0001-01-01T00:00:00Z' }],
        false,
        eff
      )
    ).toBe(false);
  });
});

describe('serializeSwitchOverTimes', () => {
  it('returns null for no entries', () => {
    expect(serializeSwitchOverTimes([])).toBeNull();
  });

  it('drops entries with an empty (or whitespace) key and trims keys', () => {
    expect(
      serializeSwitchOverTimes([
        { key: '  ', time: '2026-09-05T00:00:00Z' },
        { key: '  a  ', time: '2026-09-06T00:00:00Z' },
      ])
    ).toEqual({ a: '2026-09-06T00:00:00Z' });
  });

  it('returns null when every entry has an empty key', () => {
    expect(serializeSwitchOverTimes([{ key: '  ', time: '2026-09-05T00:00:00Z' }])).toBeNull();
  });

  it('normalizes times to the DAML Time format', () => {
    // Use an input with an explicit offset so the expected UTC value is fixed
    // regardless of the ambient timezone the test suite runs in.
    expect(serializeSwitchOverTimes([{ key: 'a', time: '2026-09-05T12:34:00+02:00' }])).toEqual({
      a: '2026-09-05T10:34:00Z',
    });
  });
});

describe('switch-over config value (serialize / parse)', () => {
  it('is the empty string for no entries', () => {
    expect(switchOverEntriesToConfigValue([])).toBe('');
    expect(switchOverMapToConfigValue(null)).toBe('');
    expect(switchOverMapToConfigValue({})).toBe('');
  });

  it('serializes entries with sorted keys (stable regardless of order)', () => {
    const a = switchOverEntriesToConfigValue([
      { key: 'b', time: '2026-09-06T00:00:00Z' },
      { key: 'a', time: '2026-09-05T00:00:00Z' },
    ]);
    const b = switchOverEntriesToConfigValue([
      { key: 'a', time: '2026-09-05T00:00:00Z' },
      { key: 'b', time: '2026-09-06T00:00:00Z' },
    ]);
    expect(a).toBe(b);
    expect(a).toBe('{"a":"2026-09-05T00:00:00Z","b":"2026-09-06T00:00:00Z"}');
  });

  it('produces the same value from entries and from the equivalent map', () => {
    const map = { a: '2026-09-05T00:00:00Z' };
    expect(switchOverMapToConfigValue(map)).toBe(
      switchOverEntriesToConfigValue([{ key: 'a', time: '2026-09-05T00:00:00Z' }])
    );
  });

  it('detects change via string inequality: added / removed / changed / renamed', () => {
    const base = switchOverMapToConfigValue({ a: '2026-09-05T00:00:00Z' });
    expect(switchOverMapToConfigValue(null)).not.toBe(base); // removed
    expect(
      switchOverEntriesToConfigValue([
        { key: 'a', time: '2026-09-05T00:00:00Z' },
        { key: 'b', time: '2026-09-06T00:00:00Z' },
      ])
    ).not.toBe(base); // added
    expect(switchOverEntriesToConfigValue([{ key: 'a', time: '2026-09-06T00:00:00Z' }])).not.toBe(
      base
    ); // changed time
    expect(switchOverEntriesToConfigValue([{ key: 'b', time: '2026-09-05T00:00:00Z' }])).not.toBe(
      base
    ); // renamed key
  });

  it('serializes a min-bound entry identically from entries and map (no spurious change)', () => {
    const map = { 'no-featured-app-choice-context': '0001-01-01T00:00:00Z' };
    expect(switchOverMapToConfigValue(map)).toBe(
      switchOverEntriesToConfigValue([
        { key: 'no-featured-app-choice-context', time: '0001-01-01T00:00:00Z' },
      ])
    );
  });

  it('round-trips through configValueToSwitchOverMap', () => {
    const value = switchOverMapToConfigValue({ a: '2026-09-05T00:00:00Z' });
    expect(configValueToSwitchOverMap(value)).toEqual({ a: '2026-09-05T00:00:00Z' });
    expect(configValueToSwitchOverMap('')).toBeNull();
    expect(configValueToSwitchOverMap(undefined)).toBeNull();
  });
});

describe('switch-over display helpers', () => {
  it('identifies switch-over config fields', () => {
    expect(isSwitchOverField('svOperationsSwitchOverTimes')).toBe(true);
    expect(isSwitchOverField('amuletSwitchOverTimes')).toBe(true);
    expect(isSwitchOverField('voteCooldownTime')).toBe(false);
  });

  it('returns no display entries for empty / unset values', () => {
    expect(switchOverConfigValueToDisplayEntries('')).toEqual([]);
    expect(switchOverConfigValueToDisplayEntries(null)).toEqual([]);
    expect(switchOverConfigValueToDisplayEntries(undefined)).toEqual([]);
  });

  it('renders sorted key -> human-readable UTC rows', () => {
    const value = switchOverEntriesToConfigValue([
      { key: 'b', time: '2026-09-06T08:00:00Z' },
      { key: 'a', time: '2026-09-05T12:34:00Z' },
    ]);
    expect(switchOverConfigValueToDisplayEntries(value)).toEqual([
      { key: 'a', time: '2026-09-05 12:34 UTC' },
      { key: 'b', time: '2026-09-06 08:00 UTC' },
    ]);
  });

  // comment #3: a min-bound DAML Time (0001-01-01) is a placeholder, not a real
  // switch-over time; it must not render at all (no raw epoch, no leftover key).
  it('drops min-bound (0001-01-01) placeholder entries from the display', () => {
    const value = '{"no-featured-app-choice-context":"0001-01-01T00:00:00Z"}';
    expect(switchOverConfigValueToDisplayEntries(value)).toEqual([]);
  });

  it('shows only real entries and drops min-bound ones', () => {
    const value =
      '{"no-featured-app-choice-context":"0001-01-01T00:00:00Z","amulet-v2":"2026-09-10T08:00:00Z"}';
    expect(switchOverConfigValueToDisplayEntries(value)).toEqual([
      { key: 'amulet-v2', time: '2026-09-10 08:00 UTC' },
    ]);
  });

  it('hides min-bound editor rows but preserves their array index', () => {
    const entries = [
      { key: 'no-featured-app-choice-context', time: '0001-01-01T00:00:00Z' },
      { key: 'amulet-v2', time: '2026-09-10T08:00:00Z' },
    ];
    expect(visibleSwitchOverRows(entries)).toEqual([{ entry: entries[1], index: 1 }]);
  });
});

describe('burn proposal validation', () => {
  it.each<[string, string | false]>([
    ['0', 'Amount must be greater than zero'],
    ['0.0000000000', 'Amount must be greater than zero'],
    ['0.0000000001', false],
    ['100.1234567891', false],
    ['100.12345678912', 'Amount can have at most 10 decimal places'],
    ['100.', 'Amount must be a valid number'],
  ])('validates burn amount %s', (amount, error) => {
    expect(validateBurnAmount(amount)).toBe(error);
  });

  it('requires the burn deadline and voting deadline to be in the future', () => {
    const past = dayjs().subtract(1, 'day').toISOString();
    const future = dayjs().add(1, 'day').toISOString();

    expect(validateBurnBefore(past)).toBe('Date must be in the future');
    expect(validateBurnBefore(future)).toBe(false);
    expect(validateExpiration(past)).toBe('Expiration must be in the future');
    expect(validateExpiration(future)).toBe(false);
  });

  it('requires a scheduled effective date to follow the voting deadline', () => {
    const expiration = dayjs().add(1, 'week');

    expect(
      validateExpiryEffectiveDate({
        expiration: expiration.toISOString(),
        effectiveDate: expiration.subtract(1, 'day').toISOString(),
      })
    ).toBe('Effective Date must be after expiration date');
    expect(
      validateExpiryEffectiveDate({
        expiration: expiration.toISOString(),
        effectiveDate: expiration.add(1, 'day').toISOString(),
      })
    ).toBe(false);
  });
});
