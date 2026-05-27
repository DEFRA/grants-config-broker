import {
  deleteBlob,
  getBucketName,
  listFiles,
  uploadBlob
} from './s3-interactions.js'
import { createS3Client } from '../common/helpers/s3/s3-client.js'
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

vi.mock('../common/helpers/s3/s3-client.js')

const bucketName = 'configs-bucket'

describe('s3-interactions', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
  beforeEach(() => {
    createS3Client.mockReturnValueOnce(mockS3Client)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const mockPutObjectResponse = { ETag: '"mock-etag"' }
  const mockS3Client = {
    send: vi.fn(() => Promise.resolve(mockPutObjectResponse))
  }

  describe('uploadBlob', () => {
    it('should upload a blob to the S3 bucket with specified key', async () => {
      const key = 'test-key'
      const body = 'test-data'

      const result = await uploadBlob(mockLogger, key, body)

      expect(createS3Client).toHaveBeenCalledTimes(1)
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: bucketName,
            Key: key,
            Body: body
          }
        })
      )
      expect(result).toEqual(mockPutObjectResponse)
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Uploaded document: ${key}, ETag: ${mockPutObjectResponse.ETag}`
      )
    })

    it('should throw an error if the upload fails', async () => {
      const key = 'test-key'
      const body = 'test-data'
      const mockError = new Error('Upload failed')

      mockS3Client.send.mockRejectedValueOnce(mockError)

      createS3Client.mockReturnValueOnce(mockS3Client)

      await expect(uploadBlob(mockLogger, key, body)).rejects.toThrow(
        'Upload failed'
      )

      expect(createS3Client).not.toHaveBeenCalled()
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: bucketName,
            Key: key,
            Body: body
          }
        })
      )
    })
  })

  describe('listFiles', () => {
    it('should list files with a given prefix', async () => {
      const prefix = 'test-prefix'
      const mockListResponse = {
        Contents: [
          { Key: 'test-prefix/file1.txt' },
          { Key: 'test-prefix/file2.txt' }
        ]
      }

      mockS3Client.send.mockResolvedValueOnce(mockListResponse)

      const result = await listFiles(mockLogger, prefix)

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: bucketName,
            Prefix: prefix
          }
        })
      )

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(ListObjectsV2Command)
      )
      expect(result).toEqual(mockListResponse.Contents)
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Found 2 files using prefix ${prefix}`
      )
    })

    it('should return an empty array if no files are found', async () => {
      const prefix = 'empty-prefix'
      const mockListResponse = {
        Contents: undefined
      }

      mockS3Client.send.mockResolvedValueOnce(mockListResponse)

      const result = await listFiles(mockLogger, prefix)

      expect(result).toEqual([])
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Found 0 files using prefix ${prefix}`
      )
    })

    it('should throw an error if listing fails', async () => {
      const prefix = 'fail-prefix'
      const mockError = new Error('List failed')

      mockS3Client.send.mockRejectedValueOnce(mockError)

      await expect(listFiles(mockLogger, prefix)).rejects.toThrow('List failed')
    })
  })

  describe('deleteBlob', () => {
    it('should delete a blob from the specified S3 bucket', async () => {
      const key = 'test-key'
      const mockDeleteResponse = { $metadata: { httpStatusCode: 204 } }

      mockS3Client.send.mockResolvedValueOnce(mockDeleteResponse)

      const result = await deleteBlob(key, mockLogger)

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: bucketName,
            Key: key
          }
        })
      )

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand)
      )
      expect(result).toBeTruthy()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Successfully deleted blob: ${key}`
      )
    })

    it('should return true and print log warning if object already deleted from S3 bucket', async () => {
      const key = 'test-key'
      const mockDeleteResponse = { $metadata: { httpStatusCode: 404 } }

      mockS3Client.send.mockResolvedValueOnce(mockDeleteResponse)

      const result = await deleteBlob(key, mockLogger)

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: bucketName,
            Key: key
          }
        })
      )

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand)
      )
      expect(result).toBeTruthy()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Blob not found or already deleted: ${key}`
      )
    })

    it('should throw an error if the deletion fails', async () => {
      const key = 'test-key'
      const mockError = new Error('Delete failed')

      mockS3Client.send.mockRejectedValueOnce(mockError)

      await expect(deleteBlob(key, mockLogger)).rejects.toThrow('Delete failed')

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: bucketName,
            Key: key
          }
        })
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: mockError },
        `Unable to delete document: ${bucketName}/${key}`
      )
    })
  })

  describe('getBucketName', () => {
    it('should return the bucket name', async () => {
      const result = getBucketName()
      expect(result).toEqual('configs-bucket')
    })
  })
})
