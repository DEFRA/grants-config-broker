import Joi from 'joi'

export const postReleaseConfigSchema = Joi.object({
  grant: Joi.string().required(),
  repository: Joi.string().required(),
  version: Joi.string().required(),
  files: Joi.array().items(Joi.string()).min(1).required(),
  status: Joi.string().lowercase().valid('draft', 'active').optional()
})

const fileSchema = Joi.object({
  fileId: Joi.string().guid().required(),
  filename: Joi.string().required(),
  contentType: Joi.string().required(),
  downloadUrl: Joi.string().uri().required(),
  fileStatus: Joi.string().required(),
  detectedContentType: Joi.string().required(),
  s3Key: Joi.string().required(),
  s3Bucket: Joi.string().required()
}).unknown(true)

export const postConfirmUploadSchema = Joi.object({
  uploadStatus: Joi.string().required(),
  metadata: Joi.object({
    reference: Joi.string().required(),
    status: Joi.string().required()
  })
    .unknown(true)
    .required(),
  form: Joi.object({
    file: fileSchema.optional(),
    files: Joi.array().items(fileSchema).optional()
  })
    .xor('file', 'files')
    .required(),
  numberOfRejectedFiles: Joi.number().required()
})

/*
{
  "uploadStatus": "ready",
  "metadata": {
    "reference": "1234",
    "status": "active"
  },
  "form": {
    "files": [
      {
        "fileId": "16463a29-a040-4921-8c98-b1adf3ff09ec",
        "filename": "document-1.pdf",
        "contentType": "application/pdf",
        "downloadUrl": "https://my-bucket.s3.eu-west-2.amazonaws.com/scanned/document-1.pdf",
        "fileStatus": "complete",
        "contentLength": 204800,
        "checksumSha256": "czZ6B/jFbdYI+uhuGpnQ097MjOwdsW4s0kEYL6vwMMo=",
        "detectedContentType": "application/pdf",
        "s3Key": "2Fcb87c080-f5d0-49e5-9afe-712bab4f4ab4/16463a29-a040-4921-8c98-b1adf3ff09ec",
        "s3Bucket": "my-bucket"
      }
    ]
  },
  "numberOfRejectedFiles": 0
}
 */

/*
{
  "uploadStatus": "ready",
  "metadata": {
    ""reference": "1234567",
    "status": "active"
  },
  "form": {
    "file": {
      "fileId": "16463a29-a040-4921-8c98-b1adf3ff09ec",
      "filename": "example-document.pdf",
      "contentType": "application/pdf",
      "downloadUrl": "https://my-bucket.s3.eu-west-2.amazonaws.com/scanned/example-document.pdf",
      "fileStatus": "complete",
      "contentLength": 204800,
      "checksumSha256": "czZ6B/jFbdYI+uhuGpnQ097MjOwdsW4s0kEYL6vwMMo=",
      "detectedContentType": "application/pdf",
      "s3Key": "2Fcb87c080-f5d0-49e5-9afe-712bab4f4ab4/16463a29-a040-4921-8c98-b1adf3ff09ec",
      "s3Bucket": "my-bucket"
    }
  },
  "numberOfRejectedFiles": 0
}
 */
