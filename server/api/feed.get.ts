import { listFeed } from '../data/store'

export default defineEventHandler((event) => {
  return listFeed(getCookie(event, 'atelier_session'))
})
