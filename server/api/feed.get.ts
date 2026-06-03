import { listFeed } from '../data/store'

export default defineEventHandler((event) => {
  return listFeed(getCookie(event, 'makings_session'))
})
