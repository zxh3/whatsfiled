/**
 * Reporting owner normalization functions.
 */

import type { Form4ReportingOwner } from "../../../types/form4.js";
import type { RawReportingOwner } from "../raw-types.js";
import {
  normalizeBoolean,
  normalizeRequiredStringValue,
  normalizeStringValue,
} from "./primitives.js";

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
      nonUsAddressFlag: normalizeBoolean(address?.rptOwnerNonUSAddressFlag),
      street1: normalizeStringValue(address?.rptOwnerStreet1),
      street2: normalizeStringValue(address?.rptOwnerStreet2),
      city: normalizeStringValue(address?.rptOwnerCity),
      nonUsStateTerritory: normalizeStringValue(
        address?.rptOwnerNonUSStateTerritory,
      ),
      state: normalizeStringValue(address?.rptOwnerState),
      country: normalizeStringValue(address?.rptOwnerCountry),
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
