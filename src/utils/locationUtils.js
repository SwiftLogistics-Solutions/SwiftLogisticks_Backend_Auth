import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load district coordinates data
const districtDataPath = path.join(__dirname, '../data/district_coordinates.json');
const districtData = JSON.parse(fs.readFileSync(districtDataPath, 'utf8'));

/**
 * Find coordinates based on address string
 * @param {string} address - The address string to search in
 * @returns {object|null} - Returns {latitude, longitude, district} or null if not found
 */
export const findCoordinatesByAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return null;
  }

  // Convert address to lowercase for case-insensitive matching
  const lowerAddress = address.toLowerCase();

  // Search through all districts
  for (const [districtName, districtInfo] of Object.entries(districtData.districts)) {
    // Check if district name matches
    if (lowerAddress.includes(districtName.toLowerCase())) {
      return {
        latitude: districtInfo.latitude,
        longitude: districtInfo.longitude,
        district: districtName,
        matchType: 'district_name'
      };
    }

    // Check if any alias matches
    for (const alias of districtInfo.aliases) {
      if (lowerAddress.includes(alias.toLowerCase())) {
        return {
          latitude: districtInfo.latitude,
          longitude: districtInfo.longitude,
          district: districtName,
          matchType: 'alias',
          matchedAlias: alias
        };
      }
    }
  }

  return null;
};

/**
 * Get all available districts
 * @returns {array} - Array of district names
 */
export const getAllDistricts = () => {
  return Object.keys(districtData.districts);
};

/**
 * Get district info by name
 * @param {string} districtName - Name of the district
 * @returns {object|null} - District information or null if not found
 */
export const getDistrictInfo = (districtName) => {
  return districtData.districts[districtName] || null;
};
