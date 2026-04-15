import {
  uploadMetaDataToS3,
  uploadVersionFilesToS3
} from './upload-version-files-to-s3.js'
import { uploadBlob } from './storage/s3-interactions.js'
import { config } from './config.js'
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs'

vi.mock('./storage/s3-interactions.js')
vi.mock('node:fs')

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('uploadVersionFilesToS3', () => {
  const releaseInfo = {
    name: 'example-grant-with-auth',
    version: '0.0.1',
    notes: 'Some info about your release'
  }

  beforeEach(() => {
    config.set('serviceVersion', '1.0.0')
  })
  it('should print warning if grant config not found', async () => {
    existsSync.mockReturnValueOnce(false)
    await uploadVersionFilesToS3(releaseInfo, 'active', mockLogger)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Uploading config for example-grant-with-auth to S3'
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Config folder for example-grant-with-auth not found, so not doing any upload'
    )
    expect(uploadBlob).not.toHaveBeenCalled()
  })

  it('should print warning if grant config not a directory', async () => {
    existsSync.mockReturnValueOnce(true)
    lstatSync.mockReturnValueOnce({ isDirectory: () => false })
    const result = await uploadVersionFilesToS3(
      releaseInfo,
      'active',
      mockLogger
    )

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Config folder for example-grant-with-auth not found, so not doing any upload'
    )
    expect(uploadBlob).not.toHaveBeenCalled()
    expect(result).to.eql([])
  })

  it('should call through to upload each of the files to S3 for the release when some found', async () => {
    existsSync.mockReturnValueOnce(true)
    lstatSync
      .mockReturnValueOnce({ isDirectory: () => true })
      .mockReturnValueOnce({ isDirectory: () => true })
      .mockReturnValueOnce({ isDirectory: () => false })
      .mockReturnValueOnce({ isDirectory: () => false })
    readdirSync.mockReturnValueOnce([
      'grants-ui',
      'grants-ui/file1.txt',
      'grants-ui/file2.txt'
    ])
    readFileSync.mockReturnValueOnce('content1').mockReturnValueOnce('content2')

    const result = await uploadVersionFilesToS3(
      releaseInfo,
      'active',
      mockLogger
    )

    expect(uploadBlob).toHaveBeenCalledTimes(3)
    expect(uploadBlob).toHaveBeenCalledWith(
      mockLogger,
      'example-grant-with-auth/0.0.1/grants-ui/file1.txt',
      'content1'
    )
    expect(uploadBlob).toHaveBeenCalledWith(
      mockLogger,
      'example-grant-with-auth/0.0.1/grants-ui/file2.txt',
      'content2'
    )
    expect(uploadBlob).toHaveBeenCalledWith(
      mockLogger,
      'example-grant-with-auth/0.0.1/metadata.json',
      '{"status":"active","releaseNotes":"Some info about your release","updatedInBrokerVersion":"1.0.0"}'
    )
    expect(result).to.eql([
      'example-grant-with-auth/0.0.1/grants-ui/file1.txt',
      'example-grant-with-auth/0.0.1/grants-ui/file2.txt',
      'example-grant-with-auth/0.0.1/metadata.json'
    ])
  })
})

describe('uploadMetaDataToS3', () => {
  beforeEach(() => {
    config.set('serviceVersion', '1.0.0')
  })
  it('should upload metadata to S3 as json file', async () => {
    await uploadMetaDataToS3(
      {
        name: 'example-grant-with-auth',
        version: '0.0.1',
        notes: 'Some info about your release'
      },
      'active',
      mockLogger
    )
    expect(uploadBlob).toHaveBeenCalledWith(
      mockLogger,
      'example-grant-with-auth/0.0.1/metadata.json',
      '{"status":"active","releaseNotes":"Some info about your release","updatedInBrokerVersion":"1.0.0"}'
    )
  })
})
