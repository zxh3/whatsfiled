/**
 * Reporting owner normalization functions.
 */

import type { Form4ReportingOwner } from "../../../types";
import type { RawReportingOwner } from "../raw-types";
import {
  normalizeBoolean,
  normalizeRequiredStringValue,
  normalizeStringValue,
} from "./primitives";

/**
 * Normalize a reporting owner from raw XML.
 */
export function normalizeReportingOwner(
  raw: RawReportingOwner,
): Form4ReportingOwner {
  const id = raw.reportingOwnerId;
  const address = raw.reportingOwnerAddress;
  const relationship = raw.reportingOwnerRelationship;

  return {
    id: {
      cik: normalizeRequiredStringValue(id?.rptOwnerCik),
      name: normalizeRequiredStringValue(id?.rptOwnerName),
    },
    address: {
      street1: normalizeStringValue(address?.rptOwnerStreet1),
      street2: normalizeStringValue(address?.rptOwnerStreet2),
      city: normalizeStringValue(address?.rptOwnerCity),
      state: normalizeStringValue(address?.rptOwnerState),
      zipCode: normalizeStringValue(address?.rptOwnerZipCode),
      stateDescription: normalizeStringValue(address?.rptOwnerStateDescription),
    },
    relationship: {
      isDirector: normalizeBoolean(relationship?.isDirector),
      isOfficer: normalizeBoolean(relationship?.isOfficer),
      isTenPercentOwner: normalizeBoolean(relationship?.isTenPercentOwner),
      isOther: normalizeBoolean(relationship?.isOther),
      officerTitle: normalizeStringValue(relationship?.officerTitle),
      otherText: normalizeStringValue(relationship?.otherText),
    },
  };
}
