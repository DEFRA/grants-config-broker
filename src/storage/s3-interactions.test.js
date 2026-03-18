import { deleteBlob, uploadBlob } from './s3-interactions.js'
import { createS3Client } from '../common/helpers/s3/s3-client.js'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'

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
        `Generated document: ${key}, ETag: ${mockPutObjectResponse.ETag}`
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
})
