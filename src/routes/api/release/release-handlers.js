import { StatusCodes } from 'http-status-codes'

export const postReleaseConfigHandler = async (req, h) => {
  await req.server.methods.sendMessage(req.payload)

  return h.response().code(StatusCodes.ACCEPTED)
}
