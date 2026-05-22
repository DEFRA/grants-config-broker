import { config } from '../config.js'

export const generateMetadataPayload = (releaseInfo, status) => {
  return JSON.stringify({
    status,
    releaseNotes: releaseInfo.notes,
    updatedInBrokerVersion: config.get('serviceVersion')
  })
}
