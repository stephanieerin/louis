import { fetchYoutubeChaptersViaYtdlp } from '../../../../utils/youtube-ytdlp-discovery'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !/^[\w-]{11}$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid YouTube video id' })
  }

  const { chapters } = await fetchYoutubeChaptersViaYtdlp(event, id)

  setHeader(event, 'Cache-Control', 'private, max-age=3600')
  return { chapters }
})
