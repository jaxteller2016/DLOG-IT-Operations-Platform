function buildTimestampKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const millis = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}${month}${day}${hour}${minute}${second}${millis}`;
}

function buildRandomSuffix() {
  return String(Math.floor(Math.random() * 900 + 100));
}

export function generateAssetId() {
  return `AST-${buildTimestampKey()}-${buildRandomSuffix()}`;
}

export function generateIncidentNumber() {
  return `INC-${buildTimestampKey()}-${buildRandomSuffix()}`;
}