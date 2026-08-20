import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateInspectionDate,
  validateInspectionFrequency,
  validatePhotoUrls,
  validateInspectionResults,
  validateMileage,
} from '../lib/inspection-validation.ts';

const id = '11111111-1111-4111-8111-111111111111';

test('inspection validation rejects incomplete or unsafe server payloads', () => {
  assert.equal(validateInspectionResults([]), 'At least one checklist result is required');
  assert.equal(validateInspectionResults([{ checklistItemId: id, result: 'fail', photoUrls: [] }]), 'A photo is required for every failed checklist item');
  assert.equal(validateInspectionResults([{ checklistItemId: id, result: 'maybe', photoUrls: [] }]), 'Invalid checklist result');
  assert.equal(validateInspectionResults([
    { checklistItemId: id, result: 'pass', photoUrls: [] },
    { checklistItemId: id, result: 'pass', photoUrls: [] },
  ]), 'Duplicate checklist item');
  assert.equal(validateInspectionResults([{ checklistItemId: id, result: 'fail', photoUrls: ['https://example.com/photo.jpg'] }]), null);
});

test('inspection validation accepts only calendar dates and nonnegative safe integer mileage', () => {
  assert.equal(validateInspectionDate('2026-02-28'), true);
  assert.equal(validateInspectionDate('2026-02-29'), false);
  assert.equal(validateInspectionDate('2026-13-01'), false);
  assert.equal(validateMileage(0), true);
  assert.equal(validateMileage(120500), true);
  assert.equal(validateMileage(-1), false);
  assert.equal(validateMileage(12.5), false);
  assert.equal(validateInspectionFrequency('daily'), true);
  assert.equal(validateInspectionFrequency('post_route'), true);
  assert.equal(validateInspectionFrequency('unexpected'), false);
  assert.equal(validatePhotoUrls(undefined), true);
  assert.equal(validatePhotoUrls(['https://example.com/photo.jpg']), true);
  assert.equal(validatePhotoUrls(['not-a-photo', 1]), false);
});
