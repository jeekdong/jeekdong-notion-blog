import qiniu from 'qiniu'
import path from 'path'
import https from 'https'
import { defaultMapImageUrl } from 'react-notion-x'
import bytes from 'bytes'
import {
  POST_PREFIX,
  BUCKET,
  CDN_URL,
  DEFAULT_WIDTH
} from '@/lib/constants'

const uploadConfig = () => {
  qiniu.conf.ACCESS_KEY = process.env.QINIU_ACCESS_KEY
  qiniu.conf.SECRET_KEY = process.env.SECRET_KEY

  const config = new qiniu.conf.Config()
  const mac = new qiniu.auth.digest.Mac(
    process.env.QINIU_ACCESS_KEY,
    process.env.SECRET_KEY
  )
  config.zone = qiniu.zone.Zone_z2

  const options = {
    scope: BUCKET
  }
  const putPolicy = new qiniu.rs.PutPolicy(options)
  const uploadToken = putPolicy.uploadToken(mac)

  return {
    config,
    uploadToken,
    mac
  }
}

const checkStat = ({
  mac, config, bucket, key
}) => {
  return new Promise((resolve, reject) => {
    const bucketManager = new qiniu.rs.BucketManager(mac, config)
    bucketManager.stat(bucket, key, function (err, respBody, respInfo) {
      if (err) {
        console.log('check img stat err', err)
        resolve(false)
      } else {
        if (respInfo.statusCode === 200) {
          resolve(true)
        } else {
          console.log('img stat empty', respBody.error)
          resolve(false)
        }
      }
    })
  })
}

const uploadImage = async ({
  url, compressUrl, id, version, config, uploadToken, mac
}) => {
  return new Promise((resolve, reject) => {
    const key = `${POST_PREFIX}/${id}-${version}${path.extname(url.slice(0, url.indexOf('?')))}`
    checkStat({
      mac,
      config,
      bucket: BUCKET,
      key
    }).then(isUploaded => {
      if (!isUploaded) {
        const formUploader = new qiniu.form_up.FormUploader(config)
        const putExtra = new qiniu.form_up.PutExtra()
        https.get(compressUrl, {}, (readableStream) => {
          formUploader.putStream(uploadToken, key, readableStream, putExtra,
            function (respErr,
              respBody,
              respInfo
            ) {
              if (respErr) {
                console.log('upload img error', respErr)
                resolve(undefined)
              }
              if (respInfo.statusCode === 200) {
                console.log('upload success', key)
                resolve(`${CDN_URL}/${key}`)
              } else {
                console.log('upload img error', respBody)
                resolve(undefined)
              }
            })
        })
      } else {
        console.log('uploaded', key)
        resolve(`${CDN_URL}/${key}`)
      }
    })
  })
}

export const replaceImgCdn = async (
  recordMap
) => {
  const {
    config,
    uploadToken,
    mac
  } = uploadConfig()

  const allBlocks = Object.keys(recordMap.block)

  console.log(JSON.stringify(recordMap))

  for (let i = 0; i < allBlocks?.length; i++) {
    const contentBlockId = allBlocks[i]
    const block = recordMap.block[contentBlockId]
    if (block?.value?.type === 'image') {
      const url = recordMap.signed_urls?.[contentBlockId] ||
          block?.value?.properties?.source?.[0]?.[0]
      const compressUrl = defaultMapImageUrl(url, block.value)

      // 处理压缩图片大小
      const compressURL = new URL(compressUrl)
      const size = block?.value?.properties?.size?.[0]?.[0]
      const formatWidth = block?.value?.format?.block_width || 0
      if (
        size &&
        bytes(size) > 1024 * 1024 * 2
      ) {
        compressURL.searchParams.set(
          'width',
          formatWidth / 1.5 > DEFAULT_WIDTH
            ? formatWidth / 2
            : DEFAULT_WIDTH
        )
      }

      const result = await uploadImage({
        url,
        compressUrl: compressURL.toString(),
        id: contentBlockId,
        version: block?.value?.version,
        config,
        uploadToken,
        mac
      })
      if (result) {
        console.log('replace img cdn', result)
        block.value.properties.source[0][0] = result
        block.value.format.display_source = result
        recordMap.signed_urls[contentBlockId] = result
      }
    }
  }
}
