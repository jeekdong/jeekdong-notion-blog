
import { createHash } from 'crypto'

import BLOG from '@/blog.config'

export const EMAIL_HASH = createHash('md5')
  .update(BLOG.email)
  .digest('hex')
  .trim()
  .toLowerCase()

export const POST_PREFIX = 'post'
export const BUCKET = 'jeekdong-blog-files'
export const CDN_URL = 'https://blog-files.jeekdong.top'
export const DEFAULT_WIDTH = 900
