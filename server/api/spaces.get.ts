import { listSpaces } from '../data/store'

export default defineEventHandler((event) => {
  return listSpaces(getCookie(event, 'atelier_session'))
})
