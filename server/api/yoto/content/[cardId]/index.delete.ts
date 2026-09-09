import { hasContentManageScope } from '../../../../utils/yoto-auth'
import { fetchYotoApi, getYotoAccessToken, getYotoAuthScope } from '../../../../utils/yoto'
import { removeJellyfinPlaylist, resolveJellyfinSyncConfig } from '../../../../utils/jellyfin-sync'

export default defineEventHandler(async (event) => {
  const cardId = getRouterParam(event, 'cardId')
  if (!cardId) {
    throw createError({ statusCode: 400, statusMessage: 'cardId is required' })
  }

  const scope = getYotoAuthScope(event)
  if (!hasContentManageScope(scope)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Reconnect to Yoto to grant playlist edit permission (user:content:manage).',
    })
  }

  const accessToken = await getYotoAccessToken(event)
  await fetchYotoApi(`/content/${cardId}`, accessToken, { method: 'DELETE' })

  const jellyfinConfig = resolveJellyfinSyncConfig(event)
  if (jellyfinConfig) {
    try {
      await removeJellyfinPlaylist(jellyfinConfig, cardId)
    }
    catch (err) {
      console.error('[jellyfin-sync] failed to remove playlist on card delete', err)
    }
  }

  return { ok: true as const }
})
