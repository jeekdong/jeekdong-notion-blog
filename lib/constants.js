
import { createHash } from 'crypto'

import BLOG from '@/blog.config'

export const EMAIL_HASH = createHash('md5')
  .update(BLOG.email)
  .digest('hex')
  .trim()
  .toLowerCase()
